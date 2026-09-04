//go:build windows

package updater

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestDownload_RetriesTransientThenSucceeds(t *testing.T) {
	downloadBackoff = 0
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) < 3 {
			// Drop the connection mid-response, like the real "wsarecv:
			// forcibly closed" failure that stalled OTA on the test machine.
			hj, _ := w.(http.Hijacker)
			conn, _, _ := hj.Hijack()
			conn.Close()
			return
		}
		w.Write([]byte("agent-binary-bytes"))
	}))
	defer srv.Close()

	data, err := download(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("download should have recovered by attempt 3: %v", err)
	}
	if string(data) != "agent-binary-bytes" {
		t.Fatalf("wrong body: %q", data)
	}
	if got := calls.Load(); got != 3 {
		t.Fatalf("expected 3 attempts, got %d", got)
	}
}

func TestDownload_NoRetryOn4xx(t *testing.T) {
	downloadBackoff = 0
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		http.Error(w, "gone", http.StatusNotFound)
	}))
	defer srv.Close()

	if _, err := download(context.Background(), srv.URL); err == nil {
		t.Fatal("expected an error for a 404 asset URL")
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("a 404 must not be retried, got %d attempts", got)
	}
}

func TestDownload_RetriesExhausted(t *testing.T) {
	downloadBackoff = 0
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	defer srv.Close()

	if _, err := download(context.Background(), srv.URL); err == nil {
		t.Fatal("expected an error after exhausting retries")
	}
	if got := calls.Load(); got != downloadAttempts {
		t.Fatalf("expected %d attempts, got %d", downloadAttempts, got)
	}
}
