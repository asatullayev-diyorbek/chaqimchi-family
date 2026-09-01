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
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui/webwin"
)

func main() {
	screen := flag.String("screen", "enroll", "enroll|consent|welcome|complete|info|childstatus|adult|existing|block|web{welcome,consent,connect,existing,complete,error}")
	flag.Parse()

	switch *screen {
	case "welcome":
		println("welcome:", ui.ShowWelcome())
	case "webwelcome":
		ok, err := webwin.ShowWelcome()
		println("webwelcome:", ok, errString(err))
	case "webconsent":
		ok, err := webwin.ShowConsent()
		println("webconsent:", ok, errString(err))
	case "webexisting":
		c, err := webwin.ShowExisting(true)
		println("webexisting:", int(c), errString(err))
	case "webcomplete":
		println("webcomplete:", errString(webwin.ShowComplete("")))
	case "weberror":
		println("weberror:", errString(webwin.ShowError("Windows service o‘rnatishda xatolik: access is denied.")))
	case "webconnect":
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		err := webwin.ShowEnroll(ctx, webwin.EnrollParams{
			Code: "482913", QRPayload: "chaqimchi://enroll?token=482913",
			ExpiresAt: time.Now().Add(9 * time.Minute),
			Wait: func(c context.Context, onErr func(error)) error {
				select {
				case <-c.Done():
					return c.Err()
				case <-time.After(6 * time.Second): // simulate the parent linking
					return nil
				}
			},
			Install: func(step func(int, float64)) error {
				for _, s := range []struct {
					st  int
					pct float64
				}{{1, 25}, {2, 45}, {3, 70}, {4, 92}} {
					step(s.st, s.pct)
					time.Sleep(700 * time.Millisecond)
				}
				return nil
			},
		})
		println("webconnect:", errString(err))
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
