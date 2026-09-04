// browser_history.go turns each browser's local history database into a
// stream of "browser_domain" events — one per page visit, carrying only the
// registrable host (never the full URL or page title). The backend folds
// these into the per-site list the parent sees under Faoliyat → Web-saytlar
// (see server/apps/tracking SitesView).
//
// The OS-specific half — locating the history files and reading them — lives
// in browser_history_windows.go; everything portable (the poll loop, the
// checkpoint file, the event shape) is here.
package tracker

import (
	"context"
	"encoding/json"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
)

// browserVisit is one page load observed in a browser's history DB.
type browserVisit struct {
	Browser   string        // "chrome", "edge", "brave", "firefox" — for the checkpoint key
	Profile   string        // e.g. "Default", "Profile 1"
	URL       string        // full URL, used only to derive the host; never sent
	VisitedAt time.Time     // UTC
	Duration  time.Duration // 0 when the browser doesn't record it
}

// checkpoints maps "<browser>/<profile>" to the newest visit time already
// emitted, so a restart neither re-sends nor skips visits.
type checkpoints map[string]time.Time

// initialBackfill bounds the very first read of a browser we've never seen:
// only visits from the last few days are reported, not the whole history.
const initialBackfill = 3 * 24 * time.Hour

// RunBrowserHistory polls installed browsers every interval and appends a
// "browser_domain" event for each new visit. dataDir holds the checkpoint
// file. Safe to run alongside the other trackers; does nothing on non-Windows.
func RunBrowserHistory(ctx context.Context, store *buffer.Store, dataDir string, interval time.Duration) {
	ckptPath := filepath.Join(dataDir, "browser_history.json")
	ckpts := loadCheckpoints(ckptPath)

	poll := func() {
		visits, err := collectBrowserVisits(ckpts)
		if err != nil {
			log.Printf("browser history: %v", err)
		}
		emitted := 0
		for _, v := range visits {
			if emitBrowserVisit(store, v) {
				emitted++
			}
			key := v.Browser + "/" + v.Profile
			if v.VisitedAt.After(ckpts[key]) {
				ckpts[key] = v.VisitedAt
			}
		}
		if emitted > 0 {
			saveCheckpoints(ckptPath, ckpts)
			log.Printf("browser history: %d visit(s) recorded", emitted)
		}
	}

	poll()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			poll()
		}
	}
}

// emitBrowserVisit stores one browser_domain event, or returns false if the
// URL has no usable host (chrome://, about:, file://, extensions, ...).
func emitBrowserVisit(store *buffer.Store, v browserVisit) bool {
	host := hostOf(v.URL)
	if host == "" {
		return false
	}
	payload, _ := json.Marshal(map[string]any{
		"type":             "browser_domain",
		"domain":           host,
		"occurred_at":      v.VisitedAt.UTC().Format(time.RFC3339),
		"duration_seconds": int(v.Duration.Seconds()),
		"browser":          v.Browser,
	})
	store.Append(buffer.Event{
		ID:        uuid.NewString(),
		Type:      "browser_domain",
		Payload:   payload,
		CreatedAt: v.VisitedAt,
	})
	return true
}

// hostOf returns the lowercase host of an http/https URL without a leading
// "www." or port, or "" for anything else. The backend re-validates, but
// keeping the raw URL out of the payload entirely is the point.
func hostOf(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return ""
	}
	h := strings.ToLower(u.Hostname())
	h = strings.TrimSuffix(h, ".")
	h = strings.TrimPrefix(h, "www.")
	if h == "" || len(h) > 253 || strings.ContainsAny(h, "/ ") {
		return ""
	}
	return h
}

func loadCheckpoints(path string) checkpoints {
	c := checkpoints{}
	data, err := os.ReadFile(path)
	if err != nil {
		return c
	}
	raw := map[string]string{}
	if json.Unmarshal(data, &raw) != nil {
		return c
	}
	for k, v := range raw {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			c[k] = t
		}
	}
	return c
}

func saveCheckpoints(path string, c checkpoints) {
	raw := make(map[string]string, len(c))
	for k, v := range c {
		raw[k] = v.UTC().Format(time.RFC3339)
	}
	data, err := json.Marshal(raw)
	if err != nil {
		return
	}
	tmp := path + ".tmp"
	if os.WriteFile(tmp, data, 0o600) == nil {
		_ = os.Rename(tmp, path)
	}
}

// since returns the earliest visit time worth reporting for a browser
// profile: its checkpoint, or (first time) a bounded backfill window.
func (c checkpoints) since(key string) time.Time {
	if t, ok := c[key]; ok {
		return t
	}
	return time.Now().Add(-initialBackfill)
}
