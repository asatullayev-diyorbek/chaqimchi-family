// Package localipc is the localhost-only channel between the Windows Guard
// Service and the code that must run in the interactive user session.
//
//   - GET  /v1/status     — read-only service status for the Desktop UI.
//   - POST /v1/foreground  — the session collector (internal/session) reports
//     the current foreground app here, because a Session 0 service can't call
//     GetForegroundWindow itself. This carries an app name only; it has no
//     rule, credential, or process-control capability, and the listener is
//     bound to 127.0.0.1.
package localipc

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"time"
)

const Address = "127.0.0.1:37641"

type Status struct {
	Service    string   `json:"service"`
	Version    string   `json:"version"`
	StartedAt  string   `json:"started_at"`
	LastSyncAt string   `json:"last_sync_at,omitempty"`
	Monitoring []string `json:"monitoring"`
	RecentLogs []string `json:"recent_logs"`
}

// ForegroundReport is the POST /v1/foreground body. App is an executable
// name like "chrome.exe", or "" when nothing is focused.
type ForegroundReport struct {
	App string `json:"app"`
}

// Handler builds the IPC routes. If foreground is non-nil, POST
// /v1/foreground is enabled and each report is delivered to it (dropped if
// the channel is momentarily full, so a slow consumer can never block the
// reporter); if nil, that route responds 404. Split out from Serve so tests
// can drive it through httptest without binding the fixed Address.
func Handler(status func() Status, foreground chan<- string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/status", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(status())
	})
	mux.HandleFunc("/v1/foreground", func(w http.ResponseWriter, r *http.Request) {
		if foreground == nil {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var report ForegroundReport
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&report); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		select {
		case foreground <- report.App:
		default:
		}
		w.WriteHeader(http.StatusNoContent)
	})
	return mux
}

// Serve runs the local IPC server on the fixed loopback Address until ctx is
// cancelled.
func Serve(ctx context.Context, status func() Status, foreground chan<- string) error {
	s := &http.Server{Handler: Handler(status, foreground), ReadHeaderTimeout: 3 * time.Second}
	ln, err := net.Listen("tcp4", Address)
	if err != nil {
		return err
	}
	go func() { <-ctx.Done(); _ = s.Shutdown(context.Background()) }()
	err = s.Serve(ln)
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}
