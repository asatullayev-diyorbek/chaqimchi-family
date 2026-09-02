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

	// Child-facing status fields, surfaced in the tray status window
	// (child-ui/status.html). TodayMinutes is the agent's running estimate
	// of today's foreground time; DailyLimitMinutes is 0 when no
	// daily_limit_minutes rule is set.
	Online            bool `json:"online"`
	TodayMinutes      int  `json:"today_minutes"`
	DailyLimitMinutes int  `json:"daily_limit_minutes,omitempty"`

	// Block is non-nil while the child should be seeing the full-screen
	// block overlay. The Session 0 service can't draw it, so it publishes
	// the directive here and the user-session Desktop app raises/dismisses
	// ui.BlockScreen as this appears and clears. Level-triggered: it stays
	// set for as long as the rule condition holds.
	Block *BlockDirective `json:"block,omitempty"`
}

// BlockDirective is the block-overlay instruction carried on Status.Block.
// Reason is "daily_limit" | "blocked_window" | "blocked_app" (only selects
// the overlay's accent); Message is the exact, already-gentle text to show.
type BlockDirective struct {
	Reason  string `json:"reason"`
	Message string `json:"message"`
}

// ForegroundReport is the POST /v1/foreground body. App is an executable
// name like "chrome.exe", or "" when nothing is focused. The Icon* fields
// are optional: the session reporter fills them the first time it sees a
// new app so the service can persist that app's icon.
type ForegroundReport struct {
	App        string `json:"app"`
	IconAppID  string `json:"icon_app_id,omitempty"`
	IconSHA256 string `json:"icon_sha256,omitempty"`
	IconPNGB64 string `json:"icon_png_b64,omitempty"`
}

// AppIconReport is one extracted app icon on its way from the session
// reporter to the service's buffer.
type AppIconReport struct {
	AppID  string
	SHA256 string
	PNGB64 string
}

// Handler builds the IPC routes. If foreground is non-nil, POST
// /v1/foreground is enabled and each report is delivered to it (dropped if
// the channel is momentarily full, so a slow consumer can never block the
// reporter); if nil, that route responds 404. Split out from Serve so tests
// can drive it through httptest without binding the fixed Address.
// Handler builds the IPC routes. onAdultAccess, if non-nil, enables
// POST /v1/adult-access: the user-session tray calls it right before it
// opens the local "Kattalar uchun" panel, and the service turns that into a
// parent-visible alert (dashboard + Telegram). It carries no credential or
// control capability — it only asks the service to notify the parent.
func Handler(status func() Status, foreground chan<- string, icons chan<- AppIconReport, onAdultAccess func(reason string)) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/adult-access", func(w http.ResponseWriter, r *http.Request) {
		if onAdultAccess == nil {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			Reason string `json:"reason"`
		}
		_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body)
		onAdultAccess(body.Reason)
		w.WriteHeader(http.StatusNoContent)
	})
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
		// An icon PNG rides this body as base64 (~4-10 KB); allow headroom
		// but still cap it so a misbehaving reporter can't stream forever.
		var report ForegroundReport
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 512*1024)).Decode(&report); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		select {
		case foreground <- report.App:
		default:
		}
		if icons != nil && report.IconAppID != "" && report.IconSHA256 != "" && report.IconPNGB64 != "" {
			select {
			case icons <- AppIconReport{AppID: report.IconAppID, SHA256: report.IconSHA256, PNGB64: report.IconPNGB64}:
			default:
			}
		}
		w.WriteHeader(http.StatusNoContent)
	})
	return mux
}

// Serve runs the local IPC server on the fixed loopback Address until ctx is
// cancelled.
func Serve(ctx context.Context, status func() Status, foreground chan<- string, icons chan<- AppIconReport, onAdultAccess func(reason string)) error {
	s := &http.Server{Handler: Handler(status, foreground, icons, onAdultAccess), ReadHeaderTimeout: 3 * time.Second}
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
