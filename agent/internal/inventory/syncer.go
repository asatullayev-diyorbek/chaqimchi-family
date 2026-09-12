// Package inventory periodically scans the device's installed-apps and
// reports it to the backend, but only when something actually changed —
// the scan itself is cheap and runs often (every few minutes) to catch
// short-lived installs, while the network upload only fires on an actual
// diff so a quiet machine doesn't hit the backend needlessly.
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

	// lastSnapshot is what the backend was last told about, keyed by app
	// name. nil until the first successful upload, so the very first tick
	// always uploads (an empty machine still needs its baseline recorded).
	lastSnapshot map[string]tracker.InstalledAppInfo
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
	Sha256      string `json:"sha256,omitempty"`
	IconB64     string `json:"icon_b64,omitempty"`
}

// Tick scans the current inventory and, only if it differs from what the
// backend was last told, uploads the new full list. Returns nil on a no-op
// (nothing changed) or a successful upload.
func (s *Syncer) Tick(ctx context.Context) error {
	apps := tracker.ScanInstalledApps()
	snapshot := make(map[string]tracker.InstalledAppInfo, len(apps))
	for _, a := range apps {
		snapshot[a.Name] = a
	}

	if s.lastSnapshot != nil && snapshotsEqual(s.lastSnapshot, snapshot) {
		return nil
	}

	if err := s.upload(ctx, apps); err != nil {
		return err
	}
	s.lastSnapshot = snapshot
	return nil
}

func snapshotsEqual(a, b map[string]tracker.InstalledAppInfo) bool {
	if len(a) != len(b) {
		return false
	}
	for name, app := range a {
		other, ok := b[name]
		if !ok || app != other {
			return false
		}
	}
	return true
}

func (s *Syncer) upload(ctx context.Context, apps []tracker.InstalledAppInfo) error {
	payload := struct {
		Apps []appPayload `json:"apps"`
	}{Apps: make([]appPayload, len(apps))}
	for i, a := range apps {
		payload.Apps[i] = appPayload{
			Name: a.Name, Version: a.Version, Publisher: a.Publisher, InstallDate: a.InstallDate,
			Sha256: a.IconSha256, IconB64: a.IconB64,
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

// Run checks immediately, then every interval, until ctx is cancelled. The
// check itself (a registry scan) is cheap, so a short interval (minutes,
// not hours) is fine — catching a short-lived install/uninstall is the
// whole point. Only an actual change triggers a network call.
func (s *Syncer) Run(ctx context.Context, interval time.Duration) {
	if err := s.Tick(ctx); err != nil {
		log.Printf("installed-apps sync: %v", err)
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.Tick(ctx); err != nil {
				log.Printf("installed-apps sync: %v", err)
			}
		}
	}
}
