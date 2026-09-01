//go:build windows

// cmd/desktop is the visible, user-session companion to the Guard Service.
// It has no monitoring or enforcement capability; it only reads the local
// service status endpoint and presents it in the notification area, plus
// the local "Kattalar uchun" panel — whose access it reports to the parent
// through the service before showing it.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui"
)

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

	tray.OnAdultPanel = func() {
		if !ui.ShowAdultAccessGate() {
			return
		}
		reportAdultAccess()
		mu.Lock()
		s := latest
		mu.Unlock()
		ui.ShowAdultPanel(s, supportURL, agentLogPath)
	}

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
			}
			time.Sleep(30 * time.Second)
		}
	}()
	tray.Run()
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
