//go:build windows

package webwin

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui"
	qrcode "github.com/skip2/go-qrcode"
)

const instW, instH = 960, 620

// ErrCodeExpired is returned by ShowEnroll when the pairing code lapsed
// before the parent linked the device; the caller regenerates and retries.
var ErrCodeExpired = errors.New("kod muddati tugadi")

func newInstaller(page, title string) (*Window, error) {
	return New(Options{Page: page, Title: title, Width: instW, Height: instH})
}

// ShowWelcome renders welcome.html (installer window 1). Returns true to proceed.
func ShowWelcome() (bool, error) {
	w, err := newInstaller("welcome.html", "ChaqimchiAI Guard — Xush kelibsiz")
	if err != nil {
		return false, err
	}
	proceed := false
	w.OnAction(func(name string, _ json.RawMessage) {
		if name == "continue" {
			proceed = true
		}
		if name != "__ready" {
			w.Close()
		}
	})
	w.Run()
	return proceed, nil
}

// ShowConsent renders consent.html (window 2). Returns true only if the
// operator ticked the acknowledgement and chose to continue.
func ShowConsent() (bool, error) {
	w, err := newInstaller("consent.html", "ChaqimchiAI Guard — Shaffoflik va rozilik")
	if err != nil {
		return false, err
	}
	accepted := false
	w.OnAction(func(name string, _ json.RawMessage) {
		if name == "accept" {
			accepted = true
		}
		if name != "__ready" {
			w.Close()
		}
	})
	w.Run()
	return accepted, nil
}

// ShowExisting renders existing.html when a prior install is detected.
func ShowExisting(running bool) (ui.ExistingChoice, error) {
	w, err := newInstaller("existing.html", "ChaqimchiAI Guard — Allaqachon o‘rnatilgan")
	if err != nil {
		return ui.ExistingCancel, err
	}
	choice := ui.ExistingCancel
	w.OnAction(func(name string, _ json.RawMessage) {
		switch name {
		case "__ready":
			w.SetState(map[string]any{"running": running})
			return
		case "upgrade":
			choice = ui.ExistingUpgrade
		case "relink":
			choice = ui.ExistingRelink
		}
		w.Close()
	})
	w.Run()
	return choice, nil
}

// ShowComplete renders complete.html (window 5). heading overrides the
// default headline (e.g. "Yangilandi" after an in-place upgrade).
func ShowComplete(heading string) error {
	w, err := newInstaller("complete.html", "ChaqimchiAI Guard — Tayyor")
	if err != nil {
		return err
	}
	w.OnAction(func(name string, _ json.RawMessage) {
		if name == "__ready" {
			if heading != "" {
				w.SetState(map[string]any{"heading": heading})
			}
			return
		}
		w.Close()
	})
	w.Run()
	return nil
}

// ShowError renders error.html with a fatal installer message.
func ShowError(message string) error {
	w, err := New(Options{Page: "error.html", Title: "ChaqimchiAI Guard — Xatolik", Width: 520, Height: 380})
	if err != nil {
		return err
	}
	w.OnAction(func(name string, _ json.RawMessage) {
		if name == "__ready" {
			w.SetState(map[string]any{"message": message})
			return
		}
		w.Close()
	})
	w.Run()
	return nil
}

// EnrollParams drives ShowEnroll.
type EnrollParams struct {
	Code      string
	QRPayload string
	ExpiresAt time.Time
	// Wait blocks until the parent links the device; onErr is called on each
	// failed poll so the window can show a connectivity warning.
	Wait func(ctx context.Context, onErr func(error)) error
	// Install performs the real install once linked; step reports progress
	// (stage 1..4, percent 0..100).
	Install func(step func(stage int, pct float64)) error
}

// ShowEnroll shows connect.html (code / QR / countdown), waits for the parent
// to link the device, then transitions the same window to installing.html and
// drives it from p.Install. Returns nil on success, ErrCodeExpired if the code
// lapsed, or context.Canceled if the operator closed the window.
func ShowEnroll(ctx context.Context, p EnrollParams) error {
	w, err := newInstaller("connect.html", "ChaqimchiAI Guard — Oilaga bog‘lash")
	if err != nil {
		return err
	}

	ctx, stop := context.WithCancel(ctx)
	defer stop()

	qrURI := ""
	if png, e := qrcode.Encode(p.QRPayload, qrcode.Medium, 512); e == nil {
		qrURI = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
	}

	var (
		once sync.Once
		res  = make(chan error, 1)
		mu   sync.Mutex
		// phase is "connect" then "install"; lastStage/lastPct let a freshly
		// loaded installing.html be caught up on its first __ready.
		phase             = "connect"
		lastStage         = 0
		lastPct   float64 = 0
	)
	finish := func(e error) {
		once.Do(func() {
			res <- e
			w.Close()
		})
	}
	pushStage := func(stage int, pct float64) {
		mu.Lock()
		lastStage, lastPct = stage, pct
		mu.Unlock()
		w.SetState(map[string]any{"stage": stage, "pct": pct})
	}

	w.OnAction(func(name string, _ json.RawMessage) {
		switch name {
		case "__ready":
			mu.Lock()
			ph, st, pc := phase, lastStage, lastPct
			mu.Unlock()
			if ph == "connect" {
				w.SetState(map[string]any{
					"code":       spaced(p.Code),
					"qr":         qrURI,
					"expires_at": p.ExpiresAt.UTC().Format(time.RFC3339),
				})
			} else if st > 0 {
				w.SetState(map[string]any{"stage": st, "pct": pc})
			}
		case "back", "cancel":
			finish(context.Canceled)
		}
	})

	// Expiry.
	go func() {
		t := time.NewTimer(time.Until(p.ExpiresAt))
		defer t.Stop()
		select {
		case <-ctx.Done():
		case <-t.C:
			finish(ErrCodeExpired)
		}
	}()

	// Wait for the link, then install.
	go func() {
		waitErr := p.Wait(ctx, func(error) { w.SetState(map[string]any{"conn_error": true}) })
		if waitErr != nil {
			if ctx.Err() == nil {
				finish(waitErr)
			}
			return
		}
		w.SetState(map[string]any{"linked": true})
		time.Sleep(700 * time.Millisecond)

		mu.Lock()
		phase = "install"
		mu.Unlock()
		w.Eval("window.location.href='installing.html'")
		pushStage(1, 15)

		installErr := p.Install(pushStage)
		if installErr != nil {
			finish(installErr)
			return
		}
		pushStage(5, 100)
		time.Sleep(900 * time.Millisecond)
		finish(nil)
	}()

	w.Run()
	select {
	case e := <-res:
		return e
	default:
		return context.Canceled // the operator closed the window directly
	}
}

// spaced turns "482913" into "482 913".
func spaced(code string) string {
	if len(code) == 6 {
		return code[:3] + " " + code[3:]
	}
	return code
}
