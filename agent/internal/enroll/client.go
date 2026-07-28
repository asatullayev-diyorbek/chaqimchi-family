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

	"github.com/gorilla/websocket"
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

// WaitForLink opens ws/enroll/<device_id>/ and blocks until the server
// pushes {"event": "linked"} or ctx is cancelled.
func (c *Client) WaitForLink(ctx context.Context, deviceID string) error {
	wsURL := wsBaseURL(c.BaseURL) + "/ws/enroll/" + deviceID + "/"

	conn, _, err := websocket.DefaultDialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return fmt.Errorf("ws dial failed: %w", err)
	}
	defer conn.Close()

	type event struct {
		Event string `json:"event"`
	}

	for {
		var e event
		if err := conn.ReadJSON(&e); err != nil {
			return err
		}
		if e.Event == "linked" {
			return nil
		}
	}
}

func wsBaseURL(baseURL string) string {
	switch {
	case len(baseURL) >= 5 && baseURL[:5] == "https":
		return "wss" + baseURL[5:]
	case len(baseURL) >= 4 && baseURL[:4] == "http":
		return "ws" + baseURL[4:]
	default:
		return baseURL
	}
}
