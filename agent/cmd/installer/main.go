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
	ui.ShowError("ChaqimchiAI Guard — O‘rnatishda xatolik", message)
	os.Exit(1)
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

	client := enroll.NewClient(*baseURL)
	hostname, _ := os.Hostname()

	install := func(c context.Context, wc webwin.Code, progress func(int, float64)) error {
		log.Printf("install: agent fayli yozilmoqda")
		progress(3, 55)
		exePath, err := installAgentBinary(*agentPath)
		if err != nil {
			return fmt.Errorf("agent faylini o‘rnatib bo‘lmadi: %w", err)
		}
		progress(3, 78)
		args := []string{"-server", *baseURL, "-device-id", wc.DeviceID, "-device-secret", wc.Secret}
		if err := service.Install(service.ServiceName, service.DisplayName, exePath, args); err != nil {
			return fmt.Errorf("Windows service o‘rnatishda xatolik: %w", err)
		}
		progress(4, 92)
		log.Printf("install: xizmat o‘rnatildi va ishga tushirildi")
		return nil
	}

	hooks := webwin.InstallHooks{
		ExistingService: func() (bool, bool) {
			info, err := service.Inspect(service.ServiceName)
			if err != nil {
				log.Printf("mavjud xizmatni tekshirib bo'lmadi: %v", err)
			}
			log.Printf("existing: installed=%v running=%v", info.Installed, info.Running)
			return info.Installed, info.Running
		},
		UpgradeInPlace: func() error {
			info, _ := service.Inspect(service.ServiceName)
			return upgradeInPlace(info, *agentPath)
		},
		StopOldService: func() error { return service.Stop(service.ServiceName) },
		NewCode: func(c context.Context) (webwin.Code, error) {
			code, err := client.GenerateCode(c, hostname)
			if err != nil {
				return webwin.Code{}, err
			}
			log.Printf("kod olindi: device %s, muddat %s", code.DeviceID, code.ExpiresAt.Format(time.Kitchen))
			return webwin.Code{
				Code: code.Code, QRPayload: code.QRPayload,
				DeviceID: code.DeviceID, Secret: code.DeviceSecret, ExpiresAt: code.ExpiresAt,
			}, nil
		},
		WaitForLink: func(c context.Context, wc webwin.Code, onErr func(error)) error {
			return client.WaitForLink(c, wc.DeviceID, onErr)
		},
		Install: install,
	}

	log.Printf("RunInstaller boshlandi")
	err := webwin.RunInstaller(ctx, hooks)
	log.Printf("RunInstaller -> %v", err)
	switch {
	case err == nil:
		fmt.Println("✓ Tayyor.")
	case errors.Is(err, webwin.ErrCanceled):
		log.Println("o'rnatish bekor qilindi (foydalanuvchi)")
	case errors.Is(err, webwin.ErrUnavailable):
		log.Printf("WebView2 mavjud emas, walk oqimiga o'tamiz")
		runWalkInstaller(ctx, client, hostname, *baseURL, *agentPath, install)
	default:
		// The wizard already showed the error page; just exit non-zero.
		os.Exit(1)
	}
}

// runWalkInstaller is the WebView2-unavailable fallback: the old sequence of
// separate walk dialogs. The real installer bundles the WebView2 runtime, so
// this is a rare path.
func runWalkInstaller(ctx context.Context, client *enroll.Client, hostname, baseURL, agentPath string, install func(context.Context, webwin.Code, func(int, float64)) error) {
	if !ui.ShowWelcome() {
		return
	}
	info, _ := service.Inspect(service.ServiceName)
	if info.Installed {
		switch ui.AskExistingInstall(info.Running) {
		case ui.ExistingUpgrade:
			if err := upgradeInPlace(info, agentPath); err != nil {
				fatalInstaller("Yangilashda xatolik: %v", err)
			}
			ui.ShowComplete()
			return
		case ui.ExistingRelink:
			_ = service.Stop(service.ServiceName)
		default:
			return
		}
	}
	if ok, _ := ui.RequireInstallerConsent(); !ok {
		return
	}
	for {
		code, err := client.GenerateCode(ctx, hostname)
		if err != nil {
			fatalInstaller("Bog‘lash kodini olishda xatolik: %v", err)
		}
		wc := webwin.Code{Code: code.Code, QRPayload: code.QRPayload, DeviceID: code.DeviceID, Secret: code.DeviceSecret, ExpiresAt: code.ExpiresAt}
		codeCtx, cancelCode := context.WithDeadline(ctx, code.ExpiresAt)
		err = ui.ShowEnrollment(codeCtx, code.Code, code.QRPayload, code.ExpiresAt,
			func(waitCtx context.Context, onErr func(error)) error {
				return client.WaitForLink(waitCtx, code.DeviceID, onErr)
			},
			func(setStatus func(string)) error {
				return install(codeCtx, wc, func(int, float64) { setStatus("O‘rnatilmoqda...") })
			})
		expired := codeCtx.Err() == context.DeadlineExceeded
		cancelCode()
		if err == nil {
			break
		}
		if expired {
			continue
		}
		if errors.Is(err, context.Canceled) {
			return
		}
		fatalInstaller("Bog‘lash/o‘rnatishda xatolik: %v", err)
	}
	ui.ShowComplete()
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
