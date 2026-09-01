//go:build windows

// cmd/installer is a one-shot binary run during setup: it asks the backend
// for an enrollment code, shows it (QR + 6-digit fallback) to the user,
// waits for the parent to link the device from the mobile app, and then
// installs cmd/agent as a Windows service configured with this device's
// credentials and failure-recovery actions (see internal/service).
package main

import (
	"context"
	_ "embed"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/endpoint"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/enroll"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/service"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui/webwin"
)

const installDir = `C:\Program Files\ChaqimchiAI`

// defaultServerURL is injected by the release build with -ldflags. The
// checked-in fallback points at the canonical production API; local builds
// should override it with -server.
var defaultServerURL = "https://api.guard.chaqimchi-ai.uz"

// embeddedAgent is built into installer.exe, so a parent downloads one file
// only. The release build script places the freshly cross-compiled agent in
// payload/ immediately before compiling this installer.
//
//go:embed payload/agent.exe
var embeddedAgent []byte

func fatalInstaller(format string, args ...any) {
	message := fmt.Sprintf(format, args...)
	log.Print(message)
	if err := webwin.ShowError(message); err != nil {
		ui.ShowError("ChaqimchiAI Guard — O‘rnatishda xatolik", message)
	}
	os.Exit(1)
}

// Each installer window tries WebView2 first and falls back to the walk
// dialog if the runtime is unavailable (the real installer bundles the
// runtime, so the fallback is belt-and-suspenders).

func showWelcome() bool {
	log.Println("oyna: welcome")
	ok, err := webwin.ShowWelcome()
	if err != nil {
		log.Printf("webview welcome fallback: %v", err)
		return ui.ShowWelcome()
	}
	log.Printf("welcome -> davom=%v", ok)
	return ok
}

func showConsent() bool {
	log.Println("oyna: consent")
	ok, err := webwin.ShowConsent()
	if err != nil {
		log.Printf("webview consent fallback: %v", err)
		ok, _ = ui.RequireInstallerConsent()
	}
	log.Printf("consent -> qabul=%v", ok)
	return ok
}

func showExisting(running bool) ui.ExistingChoice {
	log.Printf("oyna: existing (running=%v)", running)
	c, err := webwin.ShowExisting(running)
	if err != nil {
		log.Printf("webview existing-install fallback: %v", err)
		return ui.AskExistingInstall(running)
	}
	log.Printf("existing -> tanlov=%d", c)
	return c
}

func showComplete(heading string) {
	log.Println("oyna: complete")
	if err := webwin.ShowComplete(heading); err != nil {
		log.Printf("webview complete fallback: %v", err)
		ui.ShowComplete()
	}
}

func main() {
	baseURL := flag.String("server", defaultServerURL, "ChaqimchiAI backend base URL")
	agentPath := flag.String("agent-path", "", "development override: agent.exe to embed into the installation")
	allowInsecureHTTP := flag.Bool("allow-insecure-http", false, "development only: allow a non-HTTPS backend URL")
	flag.Parse()

	// A windowsgui binary has no console, so route log.* to a file the tester
	// (and support) can read when the wizard fails partway.
	logPath := filepath.Join(os.TempDir(), "chaqimchi-installer.log")
	if lf, e := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644); e == nil {
		log.SetOutput(lf)
		defer lf.Close()
	}
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("installer boshlandi (pid %d)", os.Getpid())

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	if err := endpoint.ValidateBackendURL(*baseURL, *allowInsecureHTTP); err != nil {
		fatalInstaller("Backend manzili rad etildi: %v", err)
	}

	if !showWelcome() {
		log.Println("o'rnatish to'xtatildi: xush kelibsiz oynasida bekor qilindi")
		return
	}

	// If Guard is already registered on this machine, never silently
	// overwrite it — ask the operator whether to upgrade in place (keep the
	// enrolled device) or stop it and pair again.
	existing, inspectErr := service.Inspect(service.ServiceName)
	if inspectErr != nil {
		log.Printf("mavjud o'rnatmani tekshirib bo'lmadi (yangi o'rnatish deb davom etamiz): %v", inspectErr)
	}
	if existing.Installed {
		switch showExisting(existing.Running) {
		case ui.ExistingUpgrade:
			if err := upgradeInPlace(existing, *agentPath); err != nil {
				fatalInstaller("Yangilashda xatolik: %v", err)
			}
			fmt.Println("✓ Yangilandi.")
			showComplete("Yangilandi. Guard ishlashda davom etadi.")
			return
		case ui.ExistingRelink:
			if err := service.Stop(service.ServiceName); err != nil {
				log.Printf("eski xizmatni to'xtatib bo'lmadi (davom etamiz): %v", err)
			}
		default:
			log.Println("o'rnatish bekor qilindi: qurilmada Guard allaqachon bor")
			return
		}
	}

	if !showConsent() {
		log.Println("o'rnatish to'xtatildi: shaffoflik va rozilik tasdiqlanmadi")
		return
	}

	client := enroll.NewClient(*baseURL)
	hostname, _ := os.Hostname()
	for {
		code, err := client.GenerateCode(ctx, hostname)
		if err != nil {
			fatalInstaller("Bog‘lash kodini olishda xatolik: %v", err)
		}

		codeCtx, cancelCode := context.WithDeadline(ctx, code.ExpiresAt)
		enrollErr := runEnroll(codeCtx, client, code, *baseURL, *agentPath)
		expired := codeCtx.Err() == context.DeadlineExceeded
		cancelCode()

		if enrollErr == nil {
			break
		}
		if errors.Is(enrollErr, webwin.ErrCodeExpired) || expired {
			fmt.Println("Kod muddati tugadi. Yangi kod olinmoqda...")
			continue
		}
		if errors.Is(enrollErr, context.Canceled) {
			log.Println("Foydalanuvchi qurilmani bog'lashni bekor qildi.")
			return
		}
		if ctx.Err() != nil {
			fatalInstaller("Bog‘lash vaqti tugadi: %v", ctx.Err())
		}
		fatalInstaller("Bog‘lash/o‘rnatishda xatolik: %v", enrollErr)
	}

	fmt.Println("✓ Bog'landi!")
	fmt.Println("Tayyor! ChaqimchiAI Family endi ishlamoqda.")
	showComplete("")
}

// runEnroll shows the pairing + install UI (WebView2, or the walk dialog if
// the runtime is missing) for one generated code.
func runEnroll(ctx context.Context, client *enroll.Client, code *enroll.Code, baseURL, agentPath string) error {
	wait := func(waitCtx context.Context, onError func(error)) error {
		return client.WaitForLink(waitCtx, code.DeviceID, onError)
	}
	install := func(step func(stage int, pct float64)) error {
		step(3, 55)
		exePath, installErr := installAgentBinary(agentPath)
		if installErr != nil {
			return fmt.Errorf("agent faylini o‘rnatib bo‘lmadi: %w", installErr)
		}
		step(3, 78)
		args := []string{"-server", baseURL, "-device-id", code.DeviceID, "-device-secret", code.DeviceSecret}
		if serviceErr := service.Install(service.ServiceName, service.DisplayName, exePath, args); serviceErr != nil {
			return fmt.Errorf("Windows service o‘rnatishda xatolik: %w", serviceErr)
		}
		step(4, 92)
		return nil
	}

	log.Printf("oyna: enroll (device %s, kod muddati %s)", code.DeviceID, code.ExpiresAt.Format(time.Kitchen))
	err := webwin.ShowEnroll(ctx, webwin.EnrollParams{
		Code: code.Code, QRPayload: code.QRPayload, ExpiresAt: code.ExpiresAt,
		Wait: wait, Install: install,
	})
	log.Printf("enroll -> %v", err)
	if errors.Is(err, webwin.ErrUnavailable) {
		log.Printf("webview enroll fallback: %v", err)
		return ui.ShowEnrollment(ctx, code.Code, code.QRPayload, code.ExpiresAt, wait,
			func(setStatus func(string)) error {
				return install(func(int, float64) { setStatus("O‘rnatilmoqda...") })
			})
	}
	return err
}

// upgradeInPlace replaces the installed agent binary with this installer's
// embedded copy and re-registers the service with the arguments it already
// had, so the machine stays bound to the same enrolled device. The service
// is stopped first: on Windows the running .exe can't be overwritten.
func upgradeInPlace(existing service.Info, agentOverride string) error {
	if len(existing.Args) == 0 {
		return fmt.Errorf("eski xizmat argumentlari topilmadi — “Qayta bog‘lash”ni tanlang")
	}
	if err := service.Stop(service.ServiceName); err != nil {
		return fmt.Errorf("eski xizmatni to‘xtatish: %w", err)
	}
	exePath, err := installAgentBinary(agentOverride)
	if err != nil {
		return fmt.Errorf("agent faylini yangilash: %w", err)
	}
	if err := service.Install(service.ServiceName, service.DisplayName, exePath, existing.Args); err != nil {
		return fmt.Errorf("xizmatni qayta ro‘yxatdan o‘tkazish: %w", err)
	}
	return nil
}

// installAgentBinary writes the embedded payload into a stable, service-safe
// location. It never runs a neighbouring or downloaded agent executable by
// default: the installer itself is the only public download artifact.
func installAgentBinary(overridePath string) (string, error) {
	payload := embeddedAgent
	if overridePath != "" {
		data, err := os.ReadFile(overridePath)
		if err != nil {
			return "", fmt.Errorf("reading development agent override: %w", err)
		}
		payload = data
	}
	if len(payload) == 0 {
		return "", fmt.Errorf("embedded agent payload is empty")
	}
	if err := os.MkdirAll(installDir, 0o755); err != nil {
		return "", fmt.Errorf("creating install directory: %w", err)
	}

	target := filepath.Join(installDir, "chaqimchi-agent.exe")
	tmp, err := os.CreateTemp(installDir, "agent-*.tmp")
	if err != nil {
		return "", err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if _, err := tmp.Write(payload); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(tmpName, target); err != nil {
		// The target is usually locked because the service is still running
		// (a re-install where the caller didn't stop it, or a slow stop).
		// Stop it and try once more before giving up.
		if stopErr := service.Stop(service.ServiceName); stopErr != nil {
			log.Printf("agent faylini almashtirishdan oldin xizmatni to'xtatib bo'lmadi: %v", stopErr)
		}
		if err2 := os.Rename(tmpName, target); err2 != nil {
			return "", fmt.Errorf("activating agent binary: %w", err2)
		}
	}
	return target, nil
}
