//go:build windows

package webwin

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	qrcode "github.com/skip2/go-qrcode"
)

// Installer window CSS size (webwin.New scales it to physical px by DPI).
const instW, instH = 940, 640

// ErrCanceled means the operator closed the window or chose "Bekor qilish".
var ErrCanceled = errors.New("bekor qilindi")

// Code is one pairing code for the installer flow. Secret is the device
// credential the Install hook needs; it never reaches the page.
type Code struct {
	Code             string
	QRPayload        string
	DeviceID         string
	Secret           string
	ExpiresAt        time.Time
	PreviouslyLinked bool
}

// InstallHooks are the Go-side operations the wizard calls. cmd/installer
// supplies them; webwin owns only the window and the screen sequence.
type InstallHooks struct {
	// ExistingService reports whether Guard is already registered here.
	ExistingService func() (installed, running bool)
	// UpgradeInPlace replaces the binary, keeping the enrolled device.
	UpgradeInPlace func() error
	// StopOldService stops the current service before a fresh pairing.
	StopOldService func() error
	// NewCode fetches a fresh pairing code.
	NewCode func(ctx context.Context) (Code, error)
	// WaitForLink blocks until the parent links this code; onErr fires on each
	// failed poll so the page can show an offline note.
	WaitForLink func(ctx context.Context, c Code, onErr func(error)) error
	// Install performs the real install after linking; progress(stage 1..4, pct).
	Install func(ctx context.Context, c Code, progress func(stage int, pct float64)) error
}

// RunInstaller drives the whole setup in ONE WebView2 window, navigating
// welcome.html -> [existing.html] -> consent.html -> connect.html ->
// installing.html -> complete.html (or error.html). Returns nil on success,
// ErrCanceled if the operator backed out, ErrUnavailable if WebView2 is
// missing (caller falls back to walk), or the failing step's error.
func RunInstaller(ctx context.Context, h InstallHooks) error {
	w, err := New(Options{Title: "ChaqimchiAI Guard", Width: instW, Height: instH})
	if err != nil {
		return err
	}

	wz := &wizard{w: w, h: h, act: make(chan string, 4)}
	w.OnAction(func(name string, _ json.RawMessage) {
		if name == "__ready" {
			wz.flushPending()
			return
		}
		select {
		case wz.act <- name:
		default:
		}
	})

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	done := make(chan struct{})
	go func() {
		wz.result = wz.run(ctx)
		close(done)
		w.Close()
	}()
	w.Run()  // returns when the driver calls Close, or the user closes the window
	cancel() // if it was the user: unblock the driver so it finishes
	<-done
	return wz.result
}

type wizard struct {
	w               *Window
	h               InstallHooks
	act             chan string
	mu              sync.Mutex
	pend            map[string]any
	existingRunning bool
	result          error
}

// nav navigates to page and remembers state to push once it signals __ready.
func (d *wizard) nav(page string, state map[string]any) {
	d.mu.Lock()
	d.pend = state
	d.mu.Unlock()
	d.w.navigate(page)
}

func (d *wizard) flushPending() {
	d.mu.Lock()
	p := d.pend
	d.mu.Unlock()
	if p != nil {
		d.w.SetState(p)
	}
}

func (d *wizard) waitAction(ctx context.Context) string {
	select {
	case <-ctx.Done():
		return "cancel"
	case a := <-d.act:
		return a
	}
}

func (d *wizard) run(ctx context.Context) error {
	page := "welcome"
	for {
		switch page {
		case "welcome":
			d.nav("welcome.html", nil)
			if d.waitAction(ctx) != "continue" {
				return ErrCanceled
			}
			installed := false
			running := false
			if d.h.ExistingService != nil {
				installed, running = d.h.ExistingService()
			}
			if installed {
				d.existingRunning = running
				page = "existing"
			} else {
				page = "consent"
			}

		case "existing":
			d.nav("existing.html", map[string]any{"running": d.existingRunning})
			switch d.waitAction(ctx) {
			case "upgrade":
				d.nav("installing.html", map[string]any{"stage": 3, "pct": 45, "note": "Yangilanmoqda..."})
				if err := d.h.UpgradeInPlace(); err != nil {
					return d.fail(ctx, err)
				}
				return d.done(ctx, "Yangilandi. Guard ishlashda davom etadi.")
			case "relink":
				if d.h.StopOldService != nil {
					_ = d.h.StopOldService()
				}
				page = "consent"
			default:
				return ErrCanceled
			}

		case "consent":
			d.nav("consent.html", nil)
			switch d.waitAction(ctx) {
			case "accept":
				page = "pair"
			case "back":
				page = "welcome"
			default:
				return ErrCanceled
			}

		case "pair":
			if err := d.pair(ctx); err != nil {
				if errors.Is(err, ErrCanceled) {
					return ErrCanceled
				}
				return d.fail(ctx, err)
			}
			return d.done(ctx, "")
		}
	}
}

func (d *wizard) pair(ctx context.Context) error {
	for {
		code, err := d.h.NewCode(ctx)
		if err != nil {
			return fmt.Errorf("bog‘lash kodini olishda xatolik: %w", err)
		}

		codeCtx, cancelCode := context.WithDeadline(ctx, code.ExpiresAt)
		d.nav("connect.html", map[string]any{
			"code":              spaced(code.Code),
			"qr":                qrDataURI(code.QRPayload),
			"expires_at":        code.ExpiresAt.UTC().Format(time.RFC3339),
			"previously_linked": code.PreviouslyLinked,
		})

		linkCh := make(chan error, 1)
		go func() {
			linkCh <- d.h.WaitForLink(codeCtx, code, func(error) {
				d.w.SetState(map[string]any{"conn_error": true})
			})
		}()

		var linkErr error
	wait:
		for {
			select {
			case a := <-d.act:
				if a == "back" || a == "cancel" {
					cancelCode()
					<-linkCh
					return ErrCanceled
				}
			case linkErr = <-linkCh:
				break wait
			case <-ctx.Done():
				cancelCode()
				<-linkCh
				return ErrCanceled
			}
		}
		expired := codeCtx.Err() == context.DeadlineExceeded
		cancelCode()

		if linkErr != nil {
			if expired {
				continue // regenerate a fresh code
			}
			return fmt.Errorf("bog‘lanishda xatolik: %w", linkErr)
		}

		d.w.SetState(map[string]any{"linked": true})
		time.Sleep(600 * time.Millisecond)
		d.nav("installing.html", map[string]any{"stage": 1, "pct": 15})
		if err := d.h.Install(ctx, code, func(stage int, pct float64) {
			d.w.SetState(map[string]any{"stage": stage, "pct": pct})
		}); err != nil {
			return err
		}
		d.w.SetState(map[string]any{"stage": 5, "pct": 100})
		time.Sleep(800 * time.Millisecond)
		return nil
	}
}

func (d *wizard) done(ctx context.Context, heading string) error {
	var st map[string]any
	if heading != "" {
		st = map[string]any{"heading": heading}
	}
	d.nav("complete.html", st)
	d.waitAction(ctx) // "close"
	return nil
}

func (d *wizard) fail(ctx context.Context, err error) error {
	d.nav("error.html", map[string]any{"message": err.Error()})
	d.waitAction(ctx) // "close"
	return err
}

// spaced turns "482913" into "482 913".
func spaced(code string) string {
	if len(code) == 6 {
		return code[:3] + " " + code[3:]
	}
	return code
}

func qrDataURI(payload string) string {
	png, err := qrcode.Encode(payload, qrcode.Medium, 512)
	if err != nil {
		return ""
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
}
