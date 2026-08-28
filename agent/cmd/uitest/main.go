//go:build windows

// cmd/uitest is a throwaway harness to eyeball the installer UI windows
// without running a real enrollment. Not shipped.
package main

import (
	"context"
	"errors"
	"flag"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui"
)

func main() {
	screen := flag.String("screen", "enroll", "enroll|consent")
	flag.Parse()

	switch *screen {
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
