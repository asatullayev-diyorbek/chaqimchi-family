// Package enroll talks to the ChaqimchiAI Family backend to obtain and
// watch an enrollment code (Bosqich 0). Shared by cmd/installer and,
// later, cmd/agent for re-enrollment flows.
package enroll

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	BaseURL    string // e.g. "http://localhost:8000"
	HTTPClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL:    baseURL,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type Code struct {
	DeviceID     string    `json:"device_id"`
	DeviceSecret string    `json:"device_secret"`
	Code         string    `json:"code"`
	QRPayload    string    `json:"qr_payload"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// GenerateCode calls POST /api/enroll/generate-code/.
func (c *Client) GenerateCode(ctx context.Context, deviceHint string) (*Code, error) {
	body, _ := json.Marshal(map[string]string{"device_hint": deviceHint})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.BaseURL+"/api/enroll/generate-code/", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("generate-code failed: %s: %s", resp.Status, data)
	}

	var code Code
	if err := json.NewDecoder(resp.Body).Decode(&code); err != nil {
		return nil, err
	}
	return &code, nil
}

// WaitForLink polls GET /api/enroll/status/<device_id>/ until the device
// shows as linked or ctx is cancelled.
//
// This used to open a WebSocket (ws/enroll/<device_id>/) and wait for a
// server-pushed {"event": "linked"} message. Plain WSGI hosts (e.g.
// PythonAnywhere, where this backend now runs) cannot serve WebSockets at
// all, so that dial failed immediately on every real enrollment attempt —
// polling a REST endpoint works on any host the backend is deployed to.
// onError, if non-nil, is called every time a poll attempt fails (e.g. no
// internet connection) so the caller can surface that to the user. Polling
// keeps retrying regardless — a transient network blip should not abort
// pairing — but the caller now has enough information to stop showing a
// plain countdown as if nothing were wrong.
func (c *Client) WaitForLink(ctx context.Context, deviceID string, onError func(error)) error {
	const pollInterval = 2 * time.Second

	statusURL := c.BaseURL + "/api/enroll/status/" + deviceID + "/"
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		linked, err := c.checkLinked(ctx, statusURL)
		if err == nil && linked {
			return nil
		}
		if err != nil && onError != nil {
			onError(err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (c *Client) checkLinked(ctx context.Context, statusURL string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, statusURL, nil)
	if err != nil {
		return false, err
	}
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("enroll status check failed: %s", resp.Status)
	}

	var status struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return false, err
	}
	return status.Status == "linked", nil
}
