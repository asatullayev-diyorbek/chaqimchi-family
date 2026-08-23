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
)

const installDir = `C:\Program Files\ChaqimchiAI`

// defaultServerURL is injected by the release build with -ldflags. The
// checked-in fallback points at the current shared E2E tunnel; production or
// local builds should override it with -server.
var defaultServerURL = "https://ora-splittable-illuminatedly.ngrok-free.dev"

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

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	if err := endpoint.ValidateBackendURL(*baseURL, *allowInsecureHTTP); err != nil {
		fatalInstaller("Backend manzili rad etildi: %v", err)
	}

	accepted, err := ui.RequireInstallerConsent()
	if err != nil {
		fatalInstaller("Rozilik oynasini ochib bo‘lmadi: %v", err)
	}
	if !accepted {
		log.Println("o'rnatish to'xtatildi: shaffoflik va rozilik tasdiqlanmadi")
		return
	}

	client := enroll.NewClient(*baseURL)
	hostname, _ := os.Hostname()
	var code *enroll.Code
	for {
		var err error
		code, err = client.GenerateCode(ctx, hostname)
		if err != nil {
			fatalInstaller("Bog‘lash kodini olishda xatolik: %v", err)
		}

		codeCtx, cancelCode := context.WithDeadline(ctx, code.ExpiresAt)
		err = ui.ShowEnrollment(codeCtx, code.Code, code.QRPayload, code.ExpiresAt, func(waitCtx context.Context) error {
			return client.WaitForLink(waitCtx, code.DeviceID)
		}, func(setStatus func(string)) error {
			setStatus("Xizmat sozlanmoqda...")
			exePath, installErr := installAgentBinary(*agentPath)
			if installErr != nil {
				return fmt.Errorf("agent faylini o‘rnatib bo‘lmadi: %w", installErr)
			}
			setStatus("Windows service o‘rnatilmoqda...")
			args := []string{
				"-server", *baseURL,
				"-device-id", code.DeviceID,
				"-device-secret", code.DeviceSecret,
			}
			if serviceErr := service.Install(service.ServiceName, service.DisplayName, exePath, args); serviceErr != nil {
				return fmt.Errorf("Windows service o‘rnatishda xatolik: %w", serviceErr)
			}
			setStatus("Xizmat ishga tushirilmoqda...")
			return nil
		})
		expired := codeCtx.Err() == context.DeadlineExceeded
		cancelCode()
		if err == nil {
			break
		}
		if ctx.Err() != nil {
			fatalInstaller("Bog‘lash vaqti tugadi: %v", ctx.Err())
		}
		if expired {
			fmt.Println("Kod muddati tugadi. Yangi kod olinmoqda...")
			continue
		}
		fatalInstaller("Bog‘lash/o‘rnatishda xatolik: %v", err)
	}

	fmt.Println("✓ Bog'landi!")

	fmt.Println("Tayyor! ChaqimchiAI Family endi ishlamoqda.")
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
		return "", fmt.Errorf("activating agent binary: %w", err)
	}
	return target, nil
}
