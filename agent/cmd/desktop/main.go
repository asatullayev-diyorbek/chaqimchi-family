//go:build windows

// cmd/desktop is the visible, user-session companion to the Guard Service.
// It has no monitoring or enforcement capability; it only reads the local
// service status endpoint and presents it in the notification area.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui"
)

func main() {
	endpoint := flag.String("status-endpoint", "http://"+localipc.Address+"/v1/status", "read-only local Guard Service status endpoint")
	flag.Parse()
	tray := ui.NewTray()
	go func() {
		client := &http.Client{Timeout: 3 * time.Second}
		for {
			resp, err := client.Get(*endpoint)
			if err != nil || resp.StatusCode != http.StatusOK {
				tray.SetStatus(ui.StatusOffline)
			} else {
				var status localipc.Status
				_ = json.NewDecoder(resp.Body).Decode(&status)
				resp.Body.Close()
				details := fmt.Sprintf("Service: %s\nVersiya: %s\nIshga tushgan: %s\n\nKuzatiladi:\n• %s\n\nKuzatilmaydi:\n• Parollar va xabarlar\n• Kamera yoki mikrofon\n• Klaviatura bosishlari", status.Service, status.Version, status.StartedAt, joinBullets(status.Monitoring))
				tray.SetDetails(details, joinLines(status.RecentLogs))
				tray.SetStatus(ui.StatusOK)
			}
			time.Sleep(30 * time.Second)
		}
	}()
	tray.Run()
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
