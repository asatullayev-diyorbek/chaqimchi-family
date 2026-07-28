package rules

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// AlertReporter posts a violation to the backend as soon as it's detected.
// Unlike tracking events, alerts aren't buffered for later retry — a missed
// alert (agent offline right when the violation happened) is logged and
// dropped rather than queued, since by the time connectivity returns the
// alert is stale. That's a deliberate scope cut for this bosqich, not an
// oversight: see docs/known-issues.md if this needs revisiting.
type AlertReporter struct {
	BaseURL      string
	DeviceID     string
	DeviceSecret string
	HTTPClient   *http.Client
}

func NewAlertReporter(baseURL, deviceID, deviceSecret string) *AlertReporter {
	return &AlertReporter{
		BaseURL:      baseURL,
		DeviceID:     deviceID,
		DeviceSecret: deviceSecret,
		HTTPClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (r *AlertReporter) Report(ctx context.Context, alertType string, payload map[string]any) error {
	body, err := json.Marshal(map[string]any{
		"alert_type":   alertType,
		"payload":      payload,
		"triggered_at": time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.BaseURL+"/api/alerts/report/", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Device %s:%s", r.DeviceID, r.DeviceSecret))

	resp, err := r.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("reporting alert: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("server rejected alert report: %s", resp.Status)
	}
	return nil
}
