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

	// pendingBatchID/pendingEvents hold the in-flight batch across retries:
	// if an upload fails, the *next* SyncOnce call must resend the exact
	// same events under the exact same batch_id, so the server's
	// batch_id-uniqueness idempotency can recognize "this already landed,
	// you just didn't see the ack" instead of creating a duplicate batch.
	pendingBatchID string
	pendingEvents  []buffer.Event
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
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// SyncOnce runs a single health-check + upload cycle. Returns nil if there
// was nothing to do or the batch was uploaded successfully.
func (u *Uploader) SyncOnce(ctx context.Context) error {
	if !u.Health.IsHealthy(ctx) {
		return fmt.Errorf("backend unreachable, skipping this cycle")
	}

	events := u.pendingEvents
	batchID := u.pendingBatchID

	if len(events) == 0 {
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
	}

	rawEvents := make([]json.RawMessage, len(events))
	ids := make([]string, len(events))
	for i, e := range events {
		rawEvents[i] = json.RawMessage(e.Payload)
		ids[i] = e.ID
	}

	body, err := json.Marshal(map[string]any{
		"device_id": u.DeviceID,
		"batch_id":  batchID,
		"events":    rawEvents,
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
		// Network-level failure: keep this batch pending so the next
		// cycle retries it under the same batch_id.
		u.pendingBatchID = batchID
		u.pendingEvents = events
		return fmt.Errorf("uploading batch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		u.pendingBatchID = batchID
		u.pendingEvents = events
		return fmt.Errorf("server rejected batch: %s", resp.Status)
	}

	if err := u.Store.MarkSynced(ids); err != nil {
		return fmt.Errorf("marking events synced: %w", err)
	}

	u.pendingBatchID = ""
	u.pendingEvents = nil
	return nil
}
