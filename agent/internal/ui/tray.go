//go:build windows

// Package ui is the agent's Windows-only visible surface: the system tray
// icon and the full-screen block overlay. Neither has been run on a real
// Windows machine — see the package-level note in block_screen.go for what
// that means for the confidence level here.
package ui

import (
	"sync"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/getlantern/systray"
)

type Status int

const (
	StatusOK      Status = iota // green — everything normal
	StatusWarning               // yellow — a limit warning is currently active
	StatusOffline               // gray — agent can't reach the server
)

// Tray owns the Windows system tray icon and its tooltip.
type Tray struct {
	ready      chan struct{}
	mu         sync.RWMutex
	status     Status
	statusItem *systray.MenuItem
	details    string
	logs       string
	statusData localipc.Status

	// OnAdultPanel opens the local "Kattalar uchun" panel. Set by cmd/desktop,
	// which owns the flow: report the access to the parent, then show the
	// panel. Left nil in tests / if unset the menu item does nothing.
	OnAdultPanel func()

	// OnStatus, OnPrivacy, OnLogs override the built-in walk windows for the
	// matching menu item. cmd/desktop sets these to WebView2 (webwin)
	// versions that fall back to the walk ones on error — internal/ui can't
	// import webwin itself (webwin already imports ui, for ExistingChoice).
	// nil means: use the built-in walk window below.
	OnStatus  func(data localipc.Status, current Status)
	OnPrivacy func()
	OnLogs    func(logs string)
}

func NewTray() *Tray {
	return &Tray{ready: make(chan struct{})}
}

// Run blocks until Quit is called — call it in its own goroutine from
// cmd/agent's main.
func (t *Tray) Run() {
	systray.Run(t.onReady, func() {})
}

func (t *Tray) onReady() {
	t.mu.RLock()
	status := t.status
	t.mu.RUnlock()
	systray.SetIcon(iconFor(status))
	systray.SetTooltip(tooltipFor(status))
	t.statusItem = systray.AddMenuItem(statusLabel(status), "ChaqimchiAI Child holati")
	t.statusItem.Disable()
	systray.AddSeparator()
	statusMenu := systray.AddMenuItem("Bugungi holat", "Agentning joriy holati")
	privacyMenu := systray.AddMenuItem("Nima kuzatiladi?", "Shaffoflik ma’lumoti")
	close(t.ready)

	go func() {
		for range statusMenu.ClickedCh {
			t.mu.RLock()
			current := t.status
			data := t.statusData
			onStatus := t.OnStatus
			t.mu.RUnlock()
			if onStatus != nil {
				onStatus(data, current)
			} else {
				ShowChildStatusWindow(data, current)
			}
		}
	}()
	logsMenu := systray.AddMenuItem("Oxirgi amallar", "Guard Service loglari")
	go func() {
		for range logsMenu.ClickedCh {
			t.mu.RLock()
			logs := t.logs
			onLogs := t.OnLogs
			t.mu.RUnlock()
			if logs == "" {
				logs = "Hali log mavjud emas."
			}
			if onLogs != nil {
				onLogs(logs)
			} else {
				showInfoWindow("ChaqimchiAI Guard — Oxirgi amallar", "OXIRGI AMALLAR", "So‘nggi hodisalar", logs)
			}
		}
	}()
	go func() {
		for range privacyMenu.ClickedCh {
			t.mu.RLock()
			onPrivacy := t.OnPrivacy
			t.mu.RUnlock()
			if onPrivacy != nil {
				onPrivacy()
			} else {
				ShowPrivacyNotice()
			}
		}
	}()

	systray.AddSeparator()
	adultMenu := systray.AddMenuItem("Kattalar uchun", "Ota-ona sozlamalari — ochilishi ota-onaga bildiriladi")
	go func() {
		for range adultMenu.ClickedCh {
			if t.OnAdultPanel != nil {
				t.OnAdultPanel()
			}
		}
	}()

	// Deliberately no "Chiqish"/quit menu item here: the bola-app doc
	// (chaqimchiai-family-bola-ilova-dizayn-talablari.md, 7-bo'lim) is
	// explicit that no "stop/quit the app" control may exist anywhere in
	// this interface — it would defeat the anti-tamper requirement. Quit()
	// still exists as a method because cmd/agent needs to close the tray
	// on a graceful SCM stop request, but nothing in this UI exposes it to
	// whoever is sitting at the keyboard.
}

// SetDetails updates the read-only Service information shown from the Desktop UI.
func (t *Tray) SetDetails(details, logs string) {
	t.mu.Lock()
	t.details, t.logs = details, logs
	t.mu.Unlock()
}

// SetStatusData feeds the latest service status (screen time, daily limit,
// connectivity) into the child-facing tray status window.
func (t *Tray) SetStatusData(s localipc.Status) {
	t.mu.Lock()
	t.statusData = s
	t.mu.Unlock()
}

// Quit ends the tray's event loop, unblocking Run(). Called only
// programmatically (from cmd/agent on an SCM stop/shutdown request) —
// never wire this to a UI element the child can click; see onReady's
// comment.
func (t *Tray) Quit() {
	<-t.ready
	systray.Quit()
}

// SetStatus updates the tray icon color and tooltip. Safe to call before
// Run's onReady has fired — it just waits for it.
func (t *Tray) SetStatus(status Status) {
	<-t.ready
	t.mu.Lock()
	t.status = status
	item := t.statusItem
	t.mu.Unlock()
	systray.SetIcon(iconFor(status))
	systray.SetTooltip(tooltipFor(status))
	if item != nil {
		item.SetTitle(statusLabel(status))
	}
}

// Notify surfaces a message via the tray tooltip (e.g. an upcoming
// screen-time limit warning from internal/rules.Enforcer). Deliberately
// just a tooltip update rather than a separate Shell_NotifyIcon balloon
// integration — systray already owns the one tray icon/notify-area entry,
// and running a second native notification path alongside it risks
// fighting over the same icon handle in code nobody here can run to check.
func (t *Tray) Notify(message string) {
	<-t.ready
	systray.SetTooltip(message)
}

func tooltipFor(status Status) string {
	switch status {
	case StatusWarning:
		return "ChaqimchiAI — ogohlantirish"
	case StatusOffline:
		return "ChaqimchiAI — offline"
	default:
		return "ChaqimchiAI — faol"
	}
}

func statusLabel(status Status) string {
	switch status {
	case StatusWarning:
		return "Holat: ogohlantirish"
	case StatusOffline:
		return "Holat: internet aloqasi yo‘q"
	default:
		return "Holat: faol"
	}
}
