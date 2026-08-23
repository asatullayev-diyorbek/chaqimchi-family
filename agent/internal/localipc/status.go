// Package localipc exposes a read-only localhost status endpoint between the
// Windows Guard Service and the separately running Desktop UI. It deliberately
// has no rule, credential, or process-control endpoints.
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

func Serve(ctx context.Context, status func() Status) error {
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
	s := &http.Server{Handler: mux, ReadHeaderTimeout: 3 * time.Second}
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
