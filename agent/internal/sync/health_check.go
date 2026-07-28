// Package sync checks connectivity and uploads buffered events to the
// backend. Connectivity is judged solely by a successful call to the
// backend's own /api/health/ — not by "is any interface up" or pinging a
// third party — because captive portals (hotel wifi, school networks) will
// happily answer ARP/DNS/ICMP while blocking everything else, which would
// make a naive check report "online" when uploads would actually fail.
package sync

import (
	"context"
	"net/http"
	"time"
)

type HealthChecker struct {
	BaseURL    string
	HTTPClient *http.Client
}

func NewHealthChecker(baseURL string) *HealthChecker {
	return &HealthChecker{
		BaseURL:    baseURL,
		HTTPClient: &http.Client{Timeout: 5 * time.Second},
	}
}

// IsHealthy reports whether the backend answered /api/health/ successfully.
func (h *HealthChecker) IsHealthy(ctx context.Context) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.BaseURL+"/api/health/", nil)
	if err != nil {
		return false
	}
	resp, err := h.HTTPClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
