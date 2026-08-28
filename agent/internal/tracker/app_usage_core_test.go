package tracker

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
)

func openTestStore(t *testing.T) *buffer.Store {
	t.Helper()
	store, err := buffer.Open(filepath.Join(t.TempDir(), "buffer.db"))
	if err != nil {
		t.Fatalf("opening buffer: %v", err)
	}
	t.Cleanup(func() { store.Close() })
	return store
}

func appUsageEvents(t *testing.T, store *buffer.Store) []map[string]any {
	t.Helper()
	events, err := store.GetUnsynced(1000)
	if err != nil {
		t.Fatalf("reading events: %v", err)
	}
	var out []map[string]any
	for _, e := range events {
		if e.Type != "app_usage" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal(e.Payload, &m); err != nil {
			t.Fatalf("decoding payload: %v", err)
		}
		out = append(out, m)
	}
	return out
}

func TestRunAppUsageFromObservationsFlushesOnChange(t *testing.T) {
	store := openTestStore(t)
	obs := make(chan string)
	ctx, cancel := context.WithCancel(context.Background())

	var polled []string
	done := make(chan struct{})
	go func() {
		RunAppUsageFromObservations(ctx, store, obs, func(app string) { polled = append(polled, app) })
		close(done)
	}()

	// chrome -> chrome -> vscode -> "" : one completed interval per change
	obs <- "chrome.exe"
	obs <- "chrome.exe"
	obs <- "code.exe" // flushes chrome
	obs <- ""         // flushes code
	obs <- "chrome.exe"
	cancel() // flushes the final chrome interval
	<-done

	events := appUsageEvents(t, store)
	if len(events) != 3 {
		t.Fatalf("want 3 app_usage events (chrome, code, chrome), got %d: %v", len(events), events)
	}
	if events[0]["app_name"] != "chrome.exe" || events[1]["app_name"] != "code.exe" || events[2]["app_name"] != "chrome.exe" {
		t.Fatalf("unexpected app order: %v", events)
	}
	for _, e := range events {
		if _, ok := e["started_at"].(string); !ok {
			t.Fatalf("event missing started_at: %v", e)
		}
		if _, ok := e["duration_seconds"].(float64); !ok {
			t.Fatalf("event missing duration_seconds: %v", e)
		}
	}
	if len(polled) != 5 {
		t.Fatalf("onPoll should fire once per observation (5), got %d", len(polled))
	}
}

func TestRunAppUsageFromObservationsIgnoresIdleWhenNothingFocused(t *testing.T) {
	store := openTestStore(t)
	obs := make(chan string)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		RunAppUsageFromObservations(ctx, store, obs, nil)
		close(done)
	}()

	obs <- ""
	obs <- ""
	cancel()
	<-done

	if got := appUsageEvents(t, store); len(got) != 0 {
		t.Fatalf("no app_usage events expected when nothing is ever focused, got %v", got)
	}
}

func TestRunAppUsageFromObservationsStopsWhenChannelClosed(t *testing.T) {
	store := openTestStore(t)
	obs := make(chan string, 2)
	obs <- "chrome.exe"
	close(obs)

	done := make(chan struct{})
	go func() {
		RunAppUsageFromObservations(context.Background(), store, obs, nil)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("RunAppUsageFromObservations did not return after channel close")
	}
	if got := appUsageEvents(t, store); len(got) != 1 {
		t.Fatalf("want the in-progress chrome interval flushed on close, got %v", got)
	}
}
