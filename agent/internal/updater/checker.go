// Package updater implements the agent's self-update check-and-apply loop.
//
// Integrity: every downloaded binary is verified against a pinned Ed25519
// public key (pubkey.go) and a sha256 from the server manifest BEFORE it is
// swapped into place (verify.go, apply_windows.go). A binary that fails
// either check is discarded. Downgrades are refused. A staged update that
// doesn't confirm healthy is rolled back to the previous binary on the next
// start (state_windows.go). Updates are silent — there is no per-update
// consent prompt — because the agent is a guardian the child must not be
// able to block; the parent sees the running version on the dashboard.
package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// CompareVersions compares two dot-separated version strings component by
// component numerically (e.g. "0.4.0" vs "0.10.0" — "10" correctly beats
// "4", unlike a plain string compare). Non-numeric suffixes on a component
// (e.g. "0.5.0-broken") are ignored for comparison purposes, using just the
// leading digits. Missing trailing components are treated as 0. Returns -1
// if a<b, 0 if equal, 1 if a>b. Pure function, no network/file I/O.
func CompareVersions(a, b string) int {
	aParts := versionParts(a)
	bParts := versionParts(b)

	n := len(aParts)
	if len(bParts) > n {
		n = len(bParts)
	}
	for i := 0; i < n; i++ {
		var av, bv int
		if i < len(aParts) {
			av = aParts[i]
		}
		if i < len(bParts) {
			bv = bParts[i]
		}
		if av != bv {
			if av < bv {
				return -1
			}
			return 1
		}
	}
	return 0
}

// IsNewer reports whether candidate is a strictly newer version than current.
func IsNewer(current, candidate string) bool {
	return CompareVersions(current, candidate) < 0
}

func versionParts(v string) []int {
	segments := strings.Split(v, ".")
	parts := make([]int, len(segments))
	for i, seg := range segments {
		digits := leadingDigits(seg)
		n, _ := strconv.Atoi(digits) // empty/invalid -> 0, treated as "0" component
		parts[i] = n
	}
	return parts
}

func leadingDigits(s string) string {
	for i, r := range s {
		if r < '0' || r > '9' {
			return s[:i]
		}
	}
	return s
}

type LatestVersion struct {
	Version   string `json:"version"`
	BinaryURL string `json:"binary_url"`
	// SHA256 is the lowercase hex digest of the exact binary bytes.
	SHA256 string `json:"sha256"`
	// Signature is the base64 Ed25519 signature over the exact binary bytes,
	// made with the private key matching UpdatePublicKeyHex.
	Signature string `json:"signature"`
	// Mandatory is advisory today (updates apply either way); kept so the
	// dashboard can flag a security update.
	Mandatory bool `json:"mandatory"`
}

type Checker struct {
	BaseURL        string
	DeviceID       string
	DeviceSecret   string
	CurrentVersion string
	HTTPClient     *http.Client
}

func NewChecker(baseURL, deviceID, deviceSecret, currentVersion string) *Checker {
	return &Checker{
		BaseURL:        baseURL,
		DeviceID:       deviceID,
		DeviceSecret:   deviceSecret,
		CurrentVersion: currentVersion,
		HTTPClient:     &http.Client{Timeout: 30 * time.Second},
	}
}

// FetchLatest calls GET /api/deploy/latest/. Returns (nil, nil) if the
// server has no published version yet (404) — that's a normal state, not
// an error.
func (c *Checker) FetchLatest(ctx context.Context) (*LatestVersion, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/api/deploy/latest/", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Device %s:%s", c.DeviceID, c.DeviceSecret))

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("checking for updates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server rejected version check: %s", resp.Status)
	}

	var latest LatestVersion
	if err := json.NewDecoder(resp.Body).Decode(&latest); err != nil {
		return nil, fmt.Errorf("decoding version response: %w", err)
	}
	return &latest, nil
}

// CheckOnce fetches the latest published version and reports it only if
// it's newer than CurrentVersion.
func (c *Checker) CheckOnce(ctx context.Context) (*LatestVersion, bool, error) {
	latest, err := c.FetchLatest(ctx)
	if err != nil {
		return nil, false, err
	}
	if latest == nil {
		return nil, false, nil
	}
	return latest, IsNewer(c.CurrentVersion, latest.Version), nil
}

// Run polls CheckOnce every interval and invokes onUpdate whenever a newer
// version is found. Errors (offline, server down) are swallowed by the
// caller-supplied onError so a transient failure never crashes the loop —
// the same offline-first posture as the rest of this agent.
func (c *Checker) Run(ctx context.Context, interval time.Duration, onUpdate func(*LatestVersion), onError func(error)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	check := func() {
		latest, hasUpdate, err := c.CheckOnce(ctx)
		if err != nil {
			if onError != nil {
				onError(err)
			}
			return
		}
		if hasUpdate && onUpdate != nil {
			onUpdate(latest)
		}
	}

	check()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			check()
		}
	}
}
