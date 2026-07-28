package rules

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

type Fetcher struct {
	BaseURL      string
	DeviceID     string
	DeviceSecret string
	Cache        *Cache
	HTTPClient   *http.Client
}

func NewFetcher(baseURL, deviceID, deviceSecret string, cache *Cache) *Fetcher {
	return &Fetcher{
		BaseURL:      baseURL,
		DeviceID:     deviceID,
		DeviceSecret: deviceSecret,
		Cache:        cache,
		HTTPClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

type serverRule struct {
	ID       string          `json:"id"`
	RuleType string          `json:"rule_type"`
	Value    json.RawMessage `json:"value"`
}

// FetchOnce pulls the current rule set from the server and replaces the
// local cache. On any error (offline, server down, etc) it leaves the
// existing cache untouched and returns the error — enforcement keeps
// running on the last known-good rules.
func (f *Fetcher) FetchOnce(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.BaseURL+"/api/rules/device/", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Device %s:%s", f.DeviceID, f.DeviceSecret))

	resp, err := f.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("fetching rules: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server rejected rules fetch: %s", resp.Status)
	}

	var serverRules []serverRule
	if err := json.NewDecoder(resp.Body).Decode(&serverRules); err != nil {
		return fmt.Errorf("decoding rules response: %w", err)
	}

	rules := make([]Rule, len(serverRules))
	for i, sr := range serverRules {
		rules[i] = Rule{ID: sr.ID, RuleType: sr.RuleType, Value: sr.Value}
	}

	return f.Cache.Replace(rules)
}

// Run fetches immediately, then every interval, until ctx is cancelled.
func (f *Fetcher) Run(ctx context.Context, interval time.Duration) {
	if err := f.FetchOnce(ctx); err != nil {
		log.Printf("rules fetch: %v", err)
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := f.FetchOnce(ctx); err != nil {
				log.Printf("rules fetch: %v", err)
			}
		}
	}
}
