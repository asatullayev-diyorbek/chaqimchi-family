//go:build windows

// cmd/uitest is a throwaway harness to eyeball the installer UI windows
// without running a real enrollment. Not shipped.
package main

import (
	"context"
	"errors"
	"flag"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui"
)

func main() {
	screen := flag.String("screen", "enroll", "enroll|consent|welcome|complete|info|childstatus|adult|existing|block")
	flag.Parse()

	switch *screen {
	case "welcome":
		println("welcome:", ui.ShowWelcome())
	case "complete":
		ui.ShowComplete()
	case "info":
		ui.ShowPrivacyNotice()
	case "childstatus":
		ui.ShowChildStatusWindow(localipc.Status{Online: true, TodayMinutes: 135, DailyLimitMinutes: 180}, ui.StatusOK)
	case "existing":
		println("existing:", int(ui.AskExistingInstall(true)))
	case "block":
		go func() {
			time.Sleep(8 * time.Second)
			ui.Close()
		}()
		ui.BlockScreen("Bugungi ekran vaqting tugadi. Ertaga davom etasan!\n\nSavoling bo‘lsa, ota-onangga murojaat qil")
	case "adult":
		if ui.ShowAdultAccessGate() {
			ui.ShowAdultPanel(localipc.Status{Online: true, Version: "0.4.0-rc.2", LastSyncAt: "2026-09-01T10:20:00Z", TodayMinutes: 135}, "https://guard.chaqimchi-ai.uz", `C:\ProgramData\ChaqimchiFamily\agent.log`)
		}
	case "consent":
		ok, err := ui.RequireInstallerConsent()
		println("consent:", ok, errString(err))
	default:
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		err := ui.ShowEnrollment(ctx, "482913", "chaqimchi://enroll?token=482913",
			time.Now().Add(9*time.Minute),
			func(ctx context.Context, onErr func(error)) error {
				<-ctx.Done() // never links
				return ctx.Err()
			},
			func(setStatus func(string)) error {
				setStatus("Xizmat sozlanmoqda...")
				time.Sleep(2 * time.Second)
				return nil
			},
		)
		println("enroll:", errString(err))
	}
}

func errString(err error) string {
	if err == nil {
		return "<nil>"
	}
	if errors.Is(err, context.Canceled) {
		return "canceled"
	}
	return err.Error()
}
