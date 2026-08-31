package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
)

const defaultBatchSize = 50

type Uploader struct {
	BaseURL      string
	DeviceID     string
	DeviceSecret string
	Store        *buffer.Store
	Health       *HealthChecker
	HTTPClient   *http.Client
	BatchSize    int
	SessionID    string
	// AgentVersion is reported in each batch's agent metadata so the parent
	// dashboard can show what's actually running (and OTA can confirm a
	// successful update). Defaults to "0.0.0-dev".
	AgentVersion string
	// OnSuccess, if set, is called after each fully-acked upload — the OTA
	// flow uses it to confirm a freshly-swapped binary is healthy.
	OnSuccess func()
}

func NewUploader(baseURL, deviceID, deviceSecret string, store *buffer.Store) *Uploader {
	return &Uploader{
		BaseURL:      baseURL,
		DeviceID:     deviceID,
		DeviceSecret: deviceSecret,
		Store:        store,
		Health:       NewHealthChecker(baseURL),
		HTTPClient:   &http.Client{Timeout: 30 * time.Second},
		BatchSize:    defaultBatchSize,
		SessionID:    uuid.NewString(),
		AgentVersion: "0.0.0-dev",
	}
}

// Run loops forever (until ctx is cancelled), attempting one sync cycle
// every interval. Failures are logged and left for the next cycle — events
// stay unsynced in the buffer so nothing is lost.
func (u *Uploader) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		if err := u.SyncOnce(ctx); err != nil {
			log.Printf("sync: %v", err)
		} else if u.OnSuccess != nil {
			u.OnSuccess()
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (u *Uploader) agentVersion() string {
	if u.AgentVersion == "" {
		return "0.0.0-dev"
	}
	return u.AgentVersion
}

// SyncOnce runs a single health-check + upload cycle. Returns nil if there
// was nothing to do or the batch was uploaded successfully.
func (u *Uploader) SyncOnce(ctx context.Context) error {
	if !u.Health.IsHealthy(ctx) {
		return fmt.Errorf("backend unreachable, skipping this cycle")
	}

	pending, err := u.Store.LoadPendingBatch()
	if err != nil {
		return fmt.Errorf("loading pending batch: %w", err)
	}

	var events []buffer.Event
	var batchID string
	if pending != nil {
		batchID = pending.BatchID
		events, err = u.Store.EventsByID(pending.EventIDs)
		if err != nil {
			return fmt.Errorf("loading pending batch events: %w", err)
		}
	} else {
		batchSize := u.BatchSize
		if batchSize <= 0 {
			batchSize = defaultBatchSize
		}

		fetched, err := u.Store.GetUnsynced(batchSize)
		if err != nil {
			return fmt.Errorf("reading unsynced events: %w", err)
		}
		if len(fetched) == 0 {
			return nil
		}
		events = fetched
		batchID = uuid.NewString()
		ids := make([]string, len(events))
		for i, event := range events {
			ids[i] = event.ID
		}
		if err := u.Store.ReserveBatch(batchID, ids); err != nil {
			return fmt.Errorf("reserving batch: %w", err)
		}
	}

	rawEvents := make([]json.RawMessage, len(events))
	ids := make([]string, len(events))
	for i, e := range events {
		// The buffer stores the original tracker payload. Add transport/audit
		// fields at upload time so old queued records become v1-compatible too.
		var event map[string]any
		if err := json.Unmarshal(e.Payload, &event); err != nil {
			return fmt.Errorf("decoding event %s: %w", e.ID, err)
		}
		event["event_id"] = e.ID
		if _, ok := event["occurred_at"]; !ok {
			event["occurred_at"] = e.CreatedAt.UTC().Format(time.RFC3339)
		}
		encoded, err := json.Marshal(event)
		if err != nil {
			return fmt.Errorf("encoding event %s: %w", e.ID, err)
		}
		rawEvents[i] = encoded
		ids[i] = e.ID
	}

	body, err := json.Marshal(map[string]any{
		"schema_version": 1,
		"device_id":      u.DeviceID,
		"batch_id":       batchID,
		"sent_at":        time.Now().UTC().Format(time.RFC3339),
		"agent":          map[string]any{"version": u.agentVersion(), "platform": "windows", "session_id": u.SessionID},
		"events":         rawEvents,
	})
	if err != nil {
		return fmt.Errorf("encoding batch: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.BaseURL+"/api/tracking/ingest/", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Device %s:%s", u.DeviceID, u.DeviceSecret))

	resp, err := u.HTTPClient.Do(req)
	if err != nil {
		// The durable reservation already preserves this exact batch ID for
		// the next cycle, including after a process restart.
		return fmt.Errorf("uploading batch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("server rejected batch: %s", resp.Status)
	}
	// A v1 backend echoes the committed batch ID. Do not clear the durable
	// queue if an intermediary ever responds with an acknowledgement for a
	// different batch. Empty bodies remain accepted for older dev backends.
	var ack struct {
		BatchID       string `json:"batch_id"`
		Acknowledged  bool   `json:"acknowledged"`
		EventsSaved   int    `json:"events_saved"`
		EventsSkipped int    `json:"events_skipped"`
		IconsUpdated  int    `json:"icons_updated"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ack); err == nil {
		if ack.BatchID != "" && (ack.BatchID != batchID || !ack.Acknowledged) {
			return fmt.Errorf("invalid sync acknowledgement for batch %s", batchID)
		}
		if ack.EventsSkipped > 0 || ack.IconsUpdated > 0 {
			log.Printf("ingest %s: saved=%d skipped=%d icons=%d", batchID, ack.EventsSaved, ack.EventsSkipped, ack.IconsUpdated)
		}
	}

	if err := u.Store.CompleteBatch(batchID, ids); err != nil {
		return fmt.Errorf("completing batch: %w", err)
	}
	return nil
}
