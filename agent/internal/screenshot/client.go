// Package screenshot implements the agent side of Spino24's on-demand screen
// capture. A parent queues a request in the dashboard; the agent's SYSTEM
// service polls the backend for pending requests, gets a short-lived
// presigned Cloudflare R2 upload URL, has the screen captured in the child's
// interactive session (Session 0 can't do it), uploads the JPEG straight to
// R2, and confirms.
package screenshot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client talks to the backend's /api/screenshots/ endpoints with the
// device-secret credential (same auth as the rules fetcher / uploader).
type Client struct {
	BaseURL      string
	DeviceID     string
	DeviceSecret string
	HTTPClient   *http.Client
}

func NewClient(baseURL, deviceID, deviceSecret string) *Client {
	return &Client{
		BaseURL:      baseURL,
		DeviceID:     deviceID,
		DeviceSecret: deviceSecret,
		HTTPClient:   &http.Client{Timeout: 20 * time.Second},
	}
}

// Pending is one queued capture request.
type Pending struct {
	ID        string `json:"id"`
	Retention string `json:"retention"`
	Status    string `json:"status"`
}

func (c *Client) do(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var r io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		r = bytes.NewReader(buf)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, r)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Device %s:%s", c.DeviceID, c.DeviceSecret))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.HTTPClient.Do(req)
}

// PollPending returns the capture requests waiting for this device.
func (c *Client) PollPending(ctx context.Context) ([]Pending, error) {
	resp, err := c.do(ctx, http.MethodGet, "/api/screenshots/pending/", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pending: %s", resp.Status)
	}
	var out struct {
		Results []Pending `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out.Results, nil
}

// UploadTarget is a presigned R2 PUT URL plus the server's size cap.
type UploadTarget struct {
	UploadURL string `json:"upload_url"`
	Key       string `json:"key"`
	MaxBytes  int64  `json:"max_bytes"`
}

// RequestUploadURL asks the backend for a presigned PUT for one request and
// moves it to "capturing".
func (c *Client) RequestUploadURL(ctx context.Context, id string) (UploadTarget, error) {
	var t UploadTarget
	resp, err := c.do(ctx, http.MethodPost, "/api/screenshots/"+id+"/upload-url/", nil)
	if err != nil {
		return t, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return t, fmt.Errorf("upload-url: %s", resp.Status)
	}
	return t, json.NewDecoder(resp.Body).Decode(&t)
}

// Meta is the confirmed image's metadata.
type Meta struct {
	CapturedAt time.Time `json:"captured_at"`
	Width      int       `json:"width"`
	Height     int       `json:"height"`
	SizeBytes  int       `json:"size_bytes"`
	SHA256     string    `json:"sha256"`
}

// Confirm reports a finished upload; the backend then computes expires_at.
func (c *Client) Confirm(ctx context.Context, id string, m Meta) error {
	resp, err := c.do(ctx, http.MethodPost, "/api/screenshots/"+id+"/confirm/", m)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("confirm: %s", resp.Status)
	}
	return nil
}

// Failed tells the backend a request could not be fulfilled.
func (c *Client) Failed(ctx context.Context, id, reason string) error {
	resp, err := c.do(ctx, http.MethodPost, "/api/screenshots/"+id+"/failed/", map[string]string{"error": reason})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed-report: %s", resp.Status)
	}
	return nil
}
