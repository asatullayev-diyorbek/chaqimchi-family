// Package inventory periodically reports the device's installed-apps
// snapshot to the backend. Unlike screen-time tracking, this isn't event
// buffering — the agent always sends its full CURRENT list and the server
// diffs out whatever's no longer present, so there's nothing to persist
// locally between runs.
package inventory

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/tracker"
)

type Syncer struct {
	BaseURL      string
	DeviceID     string
	DeviceSecret string
	HTTPClient   *http.Client
}

func NewSyncer(baseURL, deviceID, deviceSecret string) *Syncer {
	return &Syncer{
		BaseURL:      baseURL,
		DeviceID:     deviceID,
		DeviceSecret: deviceSecret,
		HTTPClient:   &http.Client{Timeout: 20 * time.Second},
	}
}

type appPayload struct {
	Name        string `json:"name"`
	Version     string `json:"version,omitempty"`
	Publisher   string `json:"publisher,omitempty"`
	InstallDate string `json:"install_date,omitempty"`
}

// SyncOnce scans and uploads the current inventory. A scan error never
// happens (ScanInstalledApps degrades to an empty list); a network/server
// error here just means the previous snapshot on the backend goes stale
// until the next successful run.
func (s *Syncer) SyncOnce(ctx context.Context) error {
	apps := tracker.ScanInstalledApps()
	payload := struct {
		Apps []appPayload `json:"apps"`
	}{Apps: make([]appPayload, len(apps))}
	for i, a := range apps {
		payload.Apps[i] = appPayload{
			Name: a.Name, Version: a.Version, Publisher: a.Publisher, InstallDate: a.InstallDate,
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encoding installed-apps payload: %w", err)
	}

	url := s.BaseURL + "/api/devices/" + s.DeviceID + "/installed-apps/sync/"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Device %s:%s", s.DeviceID, s.DeviceSecret))

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("syncing installed apps: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server rejected installed-apps sync: %s", resp.Status)
	}
	return nil
}

// Run syncs immediately, then every interval, until ctx is cancelled.
// Installs don't change often — a long interval (hours, not minutes) is
// plenty, so this doesn't need to ride the fast foreground-heartbeat cycle.
func (s *Syncer) Run(ctx context.Context, interval time.Duration) {
	if err := s.SyncOnce(ctx); err != nil {
		log.Printf("installed-apps sync: %v", err)
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.SyncOnce(ctx); err != nil {
				log.Printf("installed-apps sync: %v", err)
			}
		}
	}
}
