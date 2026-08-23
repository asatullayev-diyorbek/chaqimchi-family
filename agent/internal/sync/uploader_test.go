package sync

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
)

func newTestStore(t *testing.T) *buffer.Store {
	t.Helper()
	path := filepath.Join(t.TempDir(), "buffer.db")
	store, err := buffer.Open(path)
	if err != nil {
		t.Fatalf("opening store: %v", err)
	}
	t.Cleanup(func() { store.Close() })
	return store
}

func appendEvent(t *testing.T, store *buffer.Store, id string) {
	t.Helper()
	payload, _ := json.Marshal(map[string]any{"type": "device_state", "battery": 90})
	if err := store.Append(buffer.Event{
		ID: id, Type: "device_state", Payload: payload, CreatedAt: time.Now(),
	}); err != nil {
		t.Fatalf("appending event: %v", err)
	}
}

func TestSyncOnce_MarksEventsSyncedOnSuccess(t *testing.T) {
	store := newTestStore(t)
	appendEvent(t, store, "evt-1")
	appendEvent(t, store, "evt-2")

	var receivedBatchID string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health/" {
			w.WriteHeader(http.StatusOK)
			return
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		receivedBatchID, _ = body["batch_id"].(string)
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	uploader := NewUploader(server.URL, "device-1", "secret", store)
	if err := uploader.SyncOnce(context.Background()); err != nil {
		t.Fatalf("SyncOnce failed: %v", err)
	}
	if receivedBatchID == "" {
		t.Fatal("server never received a batch_id")
	}

	unsynced, err := store.GetUnsynced(10)
	if err != nil {
		t.Fatalf("GetUnsynced: %v", err)
	}
	if len(unsynced) != 0 {
		t.Fatalf("expected 0 unsynced events after success, got %d", len(unsynced))
	}
}

func TestSyncOnce_RetriesWithSameBatchIDAfterFailure(t *testing.T) {
	store := newTestStore(t)
	appendEvent(t, store, "evt-1")

	var batchIDs []string
	var attempt int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health/" {
			w.WriteHeader(http.StatusOK)
			return
		}
		n := atomic.AddInt32(&attempt, 1)
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		batchIDs = append(batchIDs, body["batch_id"].(string))
		if n == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	uploader := NewUploader(server.URL, "device-1", "secret", store)

	if err := uploader.SyncOnce(context.Background()); err == nil {
		t.Fatal("expected first SyncOnce to fail (server returned 500)")
	}
	if err := uploader.SyncOnce(context.Background()); err != nil {
		t.Fatalf("expected retry to succeed, got: %v", err)
	}

	if len(batchIDs) != 2 || batchIDs[0] != batchIDs[1] {
		t.Fatalf("expected the same batch_id reused on retry, got: %v", batchIDs)
	}

	unsynced, _ := store.GetUnsynced(10)
	if len(unsynced) != 0 {
		t.Fatalf("expected event synced after successful retry, got %d unsynced", len(unsynced))
	}
}

func TestSyncOnce_ReusesPersistedBatchAfterRestart(t *testing.T) {
	store := newTestStore(t)
	appendEvent(t, store, "evt-crash-window")

	// A reservation left by a stopped process must survive and keep the same
	// server idempotency key when a new Uploader instance starts.
	if err := store.ReserveBatch("persisted-batch-id", []string{"evt-crash-window"}); err != nil {
		t.Fatalf("ReserveBatch: %v", err)
	}

	var receivedBatchID string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health/" {
			w.WriteHeader(http.StatusOK)
			return
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		receivedBatchID, _ = body["batch_id"].(string)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	uploader := NewUploader(server.URL, "device-1", "secret", store)
	if err := uploader.SyncOnce(context.Background()); err != nil {
		t.Fatalf("SyncOnce after restart: %v", err)
	}
	if receivedBatchID != "persisted-batch-id" {
		t.Fatalf("expected persisted batch ID, got %q", receivedBatchID)
	}
	if pending, err := store.LoadPendingBatch(); err != nil || pending != nil {
		t.Fatalf("expected pending batch cleared, pending=%v err=%v", pending, err)
	}
	unsynced, _ := store.GetUnsynced(10)
	if len(unsynced) != 0 {
		t.Fatalf("expected event synced after retry, got %d unsynced", len(unsynced))
	}
}

func TestSyncOnce_KeepsEventsWhenAcknowledgementDoesNotMatch(t *testing.T) {
	store := newTestStore(t)
	appendEvent(t, store, "evt-invalid-ack")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health/" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"batch_id":"another-batch","acknowledged":true}`))
	}))
	defer server.Close()

	uploader := NewUploader(server.URL, "device-1", "secret", store)
	if err := uploader.SyncOnce(context.Background()); err == nil {
		t.Fatal("expected an error for a mismatched acknowledgement")
	}

	unsynced, err := store.GetUnsynced(10)
	if err != nil {
		t.Fatalf("GetUnsynced: %v", err)
	}
	if len(unsynced) != 1 {
		t.Fatalf("event must stay unsynced after an invalid acknowledgement, got %d", len(unsynced))
	}
	if pending, err := store.LoadPendingBatch(); err != nil || pending == nil {
		t.Fatalf("batch reservation must remain for retry, pending=%v err=%v", pending, err)
	}
}

func TestSyncOnce_SkipsWhenBackendUnhealthy(t *testing.T) {
	store := newTestStore(t)
	appendEvent(t, store, "evt-1")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	uploader := NewUploader(server.URL, "device-1", "secret", store)
	if err := uploader.SyncOnce(context.Background()); err == nil {
		t.Fatal("expected SyncOnce to report unhealthy backend")
	}

	unsynced, _ := store.GetUnsynced(10)
	if len(unsynced) != 1 {
		t.Fatalf("event should remain unsynced when backend is unhealthy, got %d", len(unsynced))
	}
}
