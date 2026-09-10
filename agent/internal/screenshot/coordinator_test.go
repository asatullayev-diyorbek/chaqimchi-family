package screenshot

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
)

// fakeBackend records the screenshot-endpoint calls the agent makes.
type fakeBackend struct {
	mu        sync.Mutex
	pending   []Pending
	uploadURL string
	confirmed []Meta
	failed    []string
}

func (f *fakeBackend) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/screenshots/pending/", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]any{"results": f.pending})
	})
	mux.HandleFunc("/api/screenshots/", func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/upload-url/"):
			f.mu.Lock()
			url := f.uploadURL
			f.mu.Unlock()
			_ = json.NewEncoder(w).Encode(UploadTarget{UploadURL: url, Key: "k", MaxBytes: 8 << 20})
		case strings.HasSuffix(r.URL.Path, "/confirm/"):
			var m Meta
			_ = json.NewDecoder(r.Body).Decode(&m)
			f.mu.Lock()
			f.confirmed = append(f.confirmed, m)
			f.pending = nil
			f.mu.Unlock()
			w.WriteHeader(http.StatusOK)
		case strings.HasSuffix(r.URL.Path, "/failed/"):
			var b struct {
				Error string `json:"error"`
			}
			_ = json.NewDecoder(r.Body).Decode(&b)
			f.mu.Lock()
			f.failed = append(f.failed, b.Error)
			f.pending = nil
			f.mu.Unlock()
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	})
	return mux
}

func TestCoordinatorHandsJobToHelperAndConfirms(t *testing.T) {
	r2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("R2 got %s, want PUT", r.Method)
		}
		io.Copy(io.Discard, r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer r2.Close()

	be := &fakeBackend{pending: []Pending{{ID: "req-1", Retention: "week", Status: "pending"}}, uploadURL: r2.URL + "/put"}
	api := httptest.NewServer(be.handler())
	defer api.Close()

	co := NewCoordinator(NewClient(api.URL, "dev", "sec"))
	co.PollInterval = 20 * time.Millisecond
	co.ActivePollInterval = 10 * time.Millisecond

	var capturedAt time.Time
	co.OnCaptured = func(at time.Time) { capturedAt = at }

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go co.Run(ctx)

	// Wait for the coordinator to expose a job for the helper.
	var job *localipc.ScreenshotJob
	for i := 0; i < 200; i++ {
		if job = co.Job(); job != nil {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if job == nil {
		t.Fatal("coordinator never exposed a job")
	}
	if job.ID != "req-1" || job.UploadURL == "" {
		t.Fatalf("bad job: %+v", job)
	}

	// Helper does the capture+upload itself, then reports success.
	co.SubmitResult(localipc.ScreenshotResult{
		ID: "req-1", OK: true, Width: 1920, Height: 1080, SizeBytes: 12345, SHA256: "abc",
	})

	be.mu.Lock()
	defer be.mu.Unlock()
	if len(be.confirmed) != 1 {
		t.Fatalf("want 1 confirm, got %d", len(be.confirmed))
	}
	if be.confirmed[0].Width != 1920 || be.confirmed[0].SizeBytes != 12345 {
		t.Fatalf("confirm meta wrong: %+v", be.confirmed[0])
	}
	if capturedAt.IsZero() {
		t.Fatal("OnCaptured not called")
	}
	if co.Job() != nil {
		t.Fatal("job should be cleared after result")
	}
}

func TestCoordinatorReportsHelperFailure(t *testing.T) {
	be := &fakeBackend{pending: []Pending{{ID: "req-2", Status: "pending"}}, uploadURL: "http://unused"}
	api := httptest.NewServer(be.handler())
	defer api.Close()

	co := NewCoordinator(NewClient(api.URL, "dev", "sec"))
	co.PollInterval = 10 * time.Millisecond
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go co.Run(ctx)

	for i := 0; i < 200 && co.Job() == nil; i++ {
		time.Sleep(5 * time.Millisecond)
	}
	if co.Job() == nil {
		t.Fatal("no job")
	}
	co.SubmitResult(localipc.ScreenshotResult{ID: "req-2", OK: false, Error: "no active session"})

	be.mu.Lock()
	defer be.mu.Unlock()
	if len(be.failed) != 1 || be.failed[0] != "no active session" {
		t.Fatalf("want failure reported, got %+v", be.failed)
	}
}

func TestCoordinatorLocalModeNeverExposesJob(t *testing.T) {
	co := NewCoordinator(NewClient("http://x", "d", "s"))
	co.Local = true
	if co.Job() != nil {
		t.Fatal("Local mode must not hand jobs to a helper")
	}
}
