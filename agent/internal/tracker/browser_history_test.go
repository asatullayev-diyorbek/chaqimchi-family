package tracker

import (
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
)

func TestHostOf(t *testing.T) {
	cases := map[string]string{
		"https://www.YouTube.com/watch?v=x": "youtube.com",
		"http://example.org:8080/a/b":       "example.org",
		"https://news.ycombinator.com/":     "news.ycombinator.com",
		"chrome://settings":                 "",
		"about:blank":                       "",
		"file:///C:/Users/x/report.pdf":     "",
		"":                                  "",
		"not a url":                         "",
	}
	for in, want := range cases {
		if got := hostOf(in); got != want {
			t.Errorf("hostOf(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestEmitBrowserVisit_DomainOnly(t *testing.T) {
	store, err := buffer.Open(filepath.Join(t.TempDir(), "b.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	at := time.Date(2026, 9, 4, 10, 0, 0, 0, time.UTC)
	if !emitBrowserVisit(store, browserVisit{Browser: "chrome", Profile: "Default", URL: "https://www.reddit.com/r/x", VisitedAt: at, Duration: 42 * time.Second}) {
		t.Fatal("expected the visit to be emitted")
	}
	if emitBrowserVisit(store, browserVisit{Browser: "chrome", Profile: "Default", URL: "chrome://newtab", VisitedAt: at}) {
		t.Fatal("chrome:// visit should be dropped")
	}

	events, err := store.GetUnsynced(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 {
		t.Fatalf("want 1 event, got %d", len(events))
	}
	var p map[string]any
	if err := json.Unmarshal(events[0].Payload, &p); err != nil {
		t.Fatal(err)
	}
	if p["type"] != "browser_domain" || p["domain"] != "reddit.com" {
		t.Fatalf("unexpected payload: %v", p)
	}
	if _, hasURL := p["url"]; hasURL {
		t.Errorf("payload must not carry the full URL: %v", p)
	}
	if p["duration_seconds"].(float64) != 42 {
		t.Errorf("duration not carried: %v", p)
	}
}

func TestCheckpointsRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cp.json")
	c := checkpoints{"chrome/Default": time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)}
	saveCheckpoints(path, c)

	got := loadCheckpoints(path)
	if !got["chrome/Default"].Equal(c["chrome/Default"]) {
		t.Fatalf("round trip: got %v want %v", got, c)
	}
	// Unknown key -> bounded backfill in the past, not the zero time.
	since := got.since("edge/Default")
	if time.Since(since) > initialBackfill+time.Minute || time.Since(since) < initialBackfill-time.Minute {
		t.Errorf("first-seen backfill window off: %v", since)
	}
}
