//go:build windows

// cmd/desktop is the visible, user-session companion to the Guard Service.
// It has no monitoring or enforcement capability; it only reads the local
// service status endpoint and presents it in the notification area, plus
// the local "Kattalar uchun" panel — whose access it reports to the parent
// through the service before showing it.
//
// Every tray window tries WebView2 (internal/ui/webwin) first and falls
// back to the matching walk dialog (internal/ui) if the runtime is missing.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui/webwin"
)

// blockController raises and dismisses the full-screen block overlay in step
// with the service's level-triggered directive (localipc.Status.Block). The
// overlay's own message loop (ui.BlockScreen) blocks its goroutine until
// ui.Close(), so it runs on a dedicated locked OS thread.
type blockController struct {
	mu      sync.Mutex
	showing bool
}

func (b *blockController) apply(d *localipc.BlockDirective) {
	if d == nil {
		b.mu.Lock()
		showing := b.showing
		b.mu.Unlock()
		if showing {
			ui.Close()
		}
		return
	}
	b.mu.Lock()
	if b.showing {
		b.mu.Unlock()
		return
	}
	b.showing = true
	b.mu.Unlock()

	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		defer func() {
			b.mu.Lock()
			b.showing = false
			b.mu.Unlock()
		}()
		ui.BlockScreen(d.Reason, d.Message) // returns when ui.Close() is called
	}()
}

const (
	supportURL     = "https://guard.chaqimchi-ai.uz"
	agentLogPath   = `C:\ProgramData\ChaqimchiFamily\agent.log`
	adultAccessURL = "http://" + localipc.Address + "/v1/adult-access"
)

func main() {
	endpoint := flag.String("status-endpoint", "http://"+localipc.Address+"/v1/status", "read-only local Guard Service status endpoint")
	flag.Parse()
	tray := ui.NewTray()

	var (
		mu     sync.Mutex
		latest localipc.Status
	)
	getLatest := func() localipc.Status {
		mu.Lock()
		defer mu.Unlock()
		return latest
	}

	tray.OnStatus = func(data localipc.Status, current ui.Status) {
		if err := webwin.ShowChildStatus(data, trayState(current)); err != nil {
			log.Printf("webview status fallback: %v", err)
			ui.ShowChildStatusWindow(data, current)
		}
	}
	tray.OnPrivacy = func() {
		if err := webwin.ShowPrivacy(); err != nil {
			log.Printf("webview privacy fallback: %v", err)
			ui.ShowPrivacyNotice()
		}
	}
	tray.OnLogs = func(logs string) {
		if err := webwin.ShowInfo("OXIRGI AMALLAR", "So‘nggi hodisalar", logs); err != nil {
			log.Printf("webview logs fallback: %v", err)
			ui.ShowError("ChaqimchiAI Guard — Oxirgi amallar", logs) // best-effort; not fatal
		}
	}
	tray.OnAdultPanel = func() {
		ok, err := webwin.ShowAdultAccessGate()
		if err != nil {
			log.Printf("webview adult-gate fallback: %v", err)
			ok = ui.ShowAdultAccessGate()
		}
		if !ok {
			return
		}
		reportAdultAccess()

		action, err := webwin.ShowAdultPanel(getLatest(), agentLogPath)
		if err != nil {
			log.Printf("webview adult-panel fallback: %v", err)
			ui.ShowAdultPanel(getLatest(), supportURL, agentLogPath)
			return
		}
		switch action {
		case webwin.AdultPanelHelp:
			openExternal(supportURL)
		case webwin.AdultPanelUninstall:
			openExternal("ms-settings:appsfeatures")
		}
	}

	var blocker blockController
	go func() {
		client := &http.Client{Timeout: 3 * time.Second}
		for {
			resp, err := client.Get(*endpoint)
			if err != nil {
				tray.SetStatus(ui.StatusOffline)
			} else if resp.StatusCode != http.StatusOK {
				resp.Body.Close()
				tray.SetStatus(ui.StatusOffline)
			} else {
				var status localipc.Status
				_ = json.NewDecoder(resp.Body).Decode(&status)
				resp.Body.Close()
				details := fmt.Sprintf("Service: %s\nVersiya: %s\nIshga tushgan: %s\n\nKuzatiladi:\n• %s\n\nKuzatilmaydi:\n• Parollar va xabarlar\n• Kamera yoki mikrofon\n• Klaviatura bosishlari", status.Service, status.Version, status.StartedAt, joinBullets(status.Monitoring))
				tray.SetDetails(details, joinLines(status.RecentLogs))
				tray.SetStatusData(status)
				mu.Lock()
				latest = status
				mu.Unlock()
				tray.SetStatus(ui.StatusOK)
				// Raise or dismiss the block overlay to match the service.
				blocker.apply(status.Block)
			}
			// Short interval: this is loopback and the overlay must appear
			// promptly once a rule (daily limit, quiet hours) trips.
			time.Sleep(5 * time.Second)
		}
	}()
	tray.Run()
}

func trayState(s ui.Status) string {
	switch s {
	case ui.StatusWarning:
		return "warn"
	case ui.StatusOffline:
		return "offline"
	default:
		return "ok"
	}
}

// openExternal hands a URL or ms-settings: URI to the shell. Best-effort.
func openExternal(target string) {
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", target).Start()
}

// reportAdultAccess asks the service to raise a parent-visible alert that
// the local panel was opened. Best-effort: if the service is unreachable the
// panel still opens (the child gains nothing by opening it), but that is
// logged nowhere here — the service owns that path.
func reportAdultAccess() {
	body, _ := json.Marshal(map[string]string{"reason": "tray"})
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(adultAccessURL, "application/json", bytes.NewReader(body))
	if err == nil {
		resp.Body.Close()
	}
}

func joinBullets(values []string) string {
	if len(values) == 0 {
		return "Ma’lumot yo‘q"
	}
	result := values[0]
	for _, value := range values[1:] {
		result += "\n• " + value
	}
	return result
}
func joinLines(values []string) string {
	if len(values) == 0 {
		return "Hali log mavjud emas."
	}
	result := values[0]
	for _, value := range values[1:] {
		result += "\n" + value
	}
	return result
}
