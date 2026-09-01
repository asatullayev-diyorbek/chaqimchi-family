//go:build windows

package webwin

import (
	"encoding/json"
	"fmt"
	"runtime"
	"sync"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
)

// trayMu serialises the tray-triggered windows (status/privacy/adult
// gate+panel/info): they're personal utility popups, not a multi-window
// workflow, so only one is ever open at a time.
var trayMu sync.Mutex

// withTrayWindow runs fn on a locked OS thread (required: the window's
// message loop is thread-affine) while holding trayMu, so New/Bind/Run all
// happen consistently on the same thread and only one tray window is open
// at a time.
func withTrayWindow(fn func()) {
	trayMu.Lock()
	defer trayMu.Unlock()
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	fn()
}

// ShowChildStatus renders status.html (the tray flyout) for localipc.Status
// s and the tray's coarse state (ok/warn/offline). If the operator follows
// the "Ota-onam nimani ko'radi?" link, ShowPrivacy is opened next.
func ShowChildStatus(s localipc.Status, state string) error {
	var runErr error
	withTrayWindow(func() {
		w, err := New(Options{Page: "status.html", Title: "ChaqimchiAI Child — Holat", Width: 400, Height: 520})
		if err != nil {
			runErr = err
			return
		}
		openPrivacy := false
		w.OnAction(func(name string, _ json.RawMessage) {
			if name == "__ready" {
				w.SetState(childStatusState(s, state))
				return
			}
			if name == "privacy" {
				openPrivacy = true
			}
			w.Close()
		})
		w.Run()
		if openPrivacy {
			showPrivacyInline()
		}
	})
	return runErr
}

func childStatusState(s localipc.Status, state string) map[string]any {
	greeting, substate := "Salom! 👋", "Bugun yaxshi ketayapti."
	switch state {
	case "warn":
		substate = "Bugungi limitga yaqin qolding."
	case "offline":
		substate = "Internet aloqasi yo‘q — aloqa tiklanganda yuboriladi."
	}
	today := s.TodayMinutes
	limitLabel, remainingLabel, pct := "Kunlik limit belgilanmagan", "", 0
	if s.DailyLimitMinutes > 0 {
		remaining := s.DailyLimitMinutes - today
		if remaining < 0 {
			remaining = 0
		}
		limitLabel = "Kunlik limit: " + humanDuration(s.DailyLimitMinutes)
		remainingLabel = humanDuration(remaining) + " qoldi"
		if today > s.DailyLimitMinutes {
			today = s.DailyLimitMinutes
		}
		pct = today * 100 / s.DailyLimitMinutes
	}
	return map[string]any{
		"greeting": greeting, "substate": substate, "state": state,
		"today_label": humanDuration(s.TodayMinutes), "limit_label": limitLabel,
		"remaining_label": remainingLabel, "progress_pct": pct,
	}
}

// ShowPrivacy renders privacy.html standalone (e.g. from the tray's "Nima
// kuzatiladi?" item).
func ShowPrivacy() error {
	var runErr error
	withTrayWindow(func() { runErr = showPrivacyInline() })
	return runErr
}

// showPrivacyInline must be called already holding trayMu / the locked OS thread.
func showPrivacyInline() error {
	w, err := New(Options{Page: "privacy.html", Title: "ChaqimchiAI Child — Shaffoflik", Width: 620, Height: 520})
	if err != nil {
		return err
	}
	w.OnAction(func(name string, _ json.RawMessage) {
		if name != "__ready" {
			w.Close()
		}
	})
	w.Run()
	return nil
}

// ShowAdultAccessGate renders adult-gate.html. Returns true if the operator
// chooses to continue.
func ShowAdultAccessGate() (bool, error) {
	var (
		ok     bool
		runErr error
	)
	withTrayWindow(func() {
		w, err := New(Options{Page: "adult-gate.html", Title: "ChaqimchiAI Child — Kattalar uchun", Width: 460, Height: 380})
		if err != nil {
			runErr = err
			return
		}
		w.OnAction(func(name string, _ json.RawMessage) {
			if name == "continue" {
				ok = true
			}
			if name != "__ready" {
				w.Close()
			}
		})
		w.Run()
	})
	return ok, runErr
}

// AdultPanelAction is what the operator did in the adult panel.
type AdultPanelAction int

const (
	AdultPanelClosed AdultPanelAction = iota
	AdultPanelHelp
	AdultPanelUninstall
)

// ShowAdultPanel renders adult-panel.html.
func ShowAdultPanel(s localipc.Status, logPath string) (AdultPanelAction, error) {
	var (
		action AdultPanelAction
		runErr error
	)
	withTrayWindow(func() {
		w, err := New(Options{Page: "adult-panel.html", Title: "ChaqimchiAI Child — Kattalar paneli", Width: 480, Height: 560})
		if err != nil {
			runErr = err
			return
		}
		w.OnAction(func(name string, _ json.RawMessage) {
			switch name {
			case "__ready":
				w.SetState(map[string]any{
					"online": s.Online, "last_sync": orDash(s.LastSyncAt), "version": orDash(s.Version),
					"today_label": humanDuration(s.TodayMinutes), "log_path": logPath,
				})
				return
			case "help":
				action = AdultPanelHelp
			case "uninstall":
				action = AdultPanelUninstall
			}
			w.Close()
		})
		w.Run()
	})
	return action, runErr
}

// ShowInfo renders info.html — a generic read-only title/body window used
// for "Bugungi holat" details and "Oxirgi amallar" logs.
func ShowInfo(eyebrow, heading, body string) error {
	var runErr error
	withTrayWindow(func() {
		w, err := New(Options{Page: "info.html", Title: "ChaqimchiAI Guard — " + heading, Width: 460, Height: 480})
		if err != nil {
			runErr = err
			return
		}
		w.OnAction(func(name string, _ json.RawMessage) {
			if name == "__ready" {
				w.SetState(map[string]any{"eyebrow": eyebrow, "heading": heading, "body": body})
				return
			}
			w.Close()
		})
		w.Run()
	})
	return runErr
}

func orDash(s string) string {
	if s == "" {
		return "hali yo‘q"
	}
	return s
}

// humanDuration renders whole minutes as "2 soat 15 daq" / "45 daq".
func humanDuration(minutes int) string {
	if minutes < 0 {
		minutes = 0
	}
	h, m := minutes/60, minutes%60
	switch {
	case h > 0 && m > 0:
		return fmt.Sprintf("%d soat %d daq", h, m)
	case h > 0:
		return fmt.Sprintf("%d soat", h)
	default:
		return fmt.Sprintf("%d daq", m)
	}
}
