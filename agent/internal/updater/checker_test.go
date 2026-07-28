package updater

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"0.4.0", "0.4.0", 0},
		{"0.3.0", "0.4.0", -1},
		{"0.4.0", "0.3.0", 1},
		{"0.4.0", "0.10.0", -1}, // numeric, not lexicographic — 4 < 10
		{"0.10.0", "0.4.0", 1},
		{"0.4", "0.4.0", 0},       // missing trailing component treated as 0
		{"1.0.0", "0.99.0", 1},
		{"0.5.0-broken", "0.5.0", 0}, // non-numeric suffix ignored
	}
	for _, c := range cases {
		if got := CompareVersions(c.a, c.b); got != c.want {
			t.Errorf("CompareVersions(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestIsNewer(t *testing.T) {
	if !IsNewer("0.3.0", "0.4.0") {
		t.Error("expected 0.4.0 to be newer than 0.3.0")
	}
	if IsNewer("0.4.0", "0.4.0") {
		t.Error("equal versions should not be 'newer'")
	}
	if IsNewer("0.4.0", "0.3.0") {
		t.Error("0.3.0 should not be newer than 0.4.0")
	}
}

func TestCheckOnce_NoUpdateWhenCurrent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(LatestVersion{Version: "0.4.0", BinaryURL: "https://x/agent.exe"})
	}))
	defer server.Close()

	checker := NewChecker(server.URL, "device-1", "secret", "0.4.0")
	latest, hasUpdate, err := checker.CheckOnce(context.Background())
	if err != nil {
		t.Fatalf("CheckOnce failed: %v", err)
	}
	if hasUpdate {
		t.Errorf("expected no update when already on latest version, got hasUpdate=true (latest=%v)", latest)
	}
}

func TestCheckOnce_ReportsUpdateWhenNewer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if auth := r.Header.Get("Authorization"); auth != "Device device-1:secret" {
			t.Errorf("unexpected Authorization header: %q", auth)
		}
		json.NewEncoder(w).Encode(LatestVersion{Version: "0.5.0", BinaryURL: "https://x/agent-0.5.0.exe"})
	}))
	defer server.Close()

	checker := NewChecker(server.URL, "device-1", "secret", "0.4.0")
	latest, hasUpdate, err := checker.CheckOnce(context.Background())
	if err != nil {
		t.Fatalf("CheckOnce failed: %v", err)
	}
	if !hasUpdate {
		t.Fatal("expected an update to be reported")
	}
	if latest.Version != "0.5.0" || latest.BinaryURL != "https://x/agent-0.5.0.exe" {
		t.Errorf("unexpected latest version payload: %+v", latest)
	}
}

func TestFetchLatest_NoVersionPublishedYet(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	checker := NewChecker(server.URL, "device-1", "secret", "0.4.0")
	latest, err := checker.FetchLatest(context.Background())
	if err != nil {
		t.Fatalf("expected no error on 404 (no version published), got: %v", err)
	}
	if latest != nil {
		t.Errorf("expected nil latest version, got %+v", latest)
	}
}
