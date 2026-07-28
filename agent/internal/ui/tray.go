//go:build windows

// Package ui is the agent's Windows-only visible surface: the system tray
// icon and the full-screen block overlay. Neither has been run on a real
// Windows machine — see the package-level note in block_screen.go for what
// that means for the confidence level here.
package ui

import (
	"github.com/getlantern/systray"
)

type Status int

const (
	StatusOK      Status = iota // green — everything normal
	StatusWarning               // yellow — a limit warning is currently active
	StatusOffline                // gray — agent can't reach the server
)

// Tray owns the Windows system tray icon and its tooltip.
type Tray struct {
	ready chan struct{}
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
	systray.SetIcon(iconFor(StatusOK))
	systray.SetTooltip(tooltipFor(StatusOK))
	close(t.ready)

	// Deliberately no "Chiqish"/quit menu item here: the bola-app doc
	// (chaqimchiai-family-bola-ilova-dizayn-talablari.md, 7-bo'lim) is
	// explicit that no "stop/quit the app" control may exist anywhere in
	// this interface — it would defeat the anti-tamper requirement. Quit()
	// still exists as a method because cmd/agent needs to close the tray
	// on a graceful SCM stop request, but nothing in this UI exposes it to
	// whoever is sitting at the keyboard.
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
	systray.SetIcon(iconFor(status))
	systray.SetTooltip(tooltipFor(status))
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
