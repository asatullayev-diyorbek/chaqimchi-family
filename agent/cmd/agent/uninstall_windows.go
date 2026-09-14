//go:build windows

package main

// Cross-compiled and type-checked only — see internal/service/
// windows_service.go's doc comment for why that caveat matters generally,
// and this file's own comment on runUninstall for why it matters
// especially here: this is the ONLY code path that removes the service, so
// a bug here is a family stuck unable to get the agent off a machine
// through any normal means.

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/lxn/walk"

	"spino24agent/internal/rules"
	"spino24agent/internal/service"
)

const uninstallTitle = "Spino24 Guard — O'chirish"

// runUninstall is what Windows runs when the parent clicks "Uninstall" in
// Apps & Features (see internal/service.RegisterUninstaller — the
// UninstallString it writes is exactly "<this exe> -uninstall"). It always
// asks for confirmation first (a stray double-click on the wrong Uninstall
// button should not silently remove monitoring), tells the backend BEFORE
// touching the service (once the service is gone there is no process left
// to report through — a silent removal is exactly the failure mode the
// whole feature exists to prevent), then deletes the service and the
// Add/Remove Programs entry itself. Deliberately does not delete the
// installed files: the exe cannot delete itself while running, and leaving
// C:\Program Files\Spino24 behind (now inert — no service, no
// Add/Remove Programs entry) is a acceptable tradeoff a parent can clean up
// by hand if they care to.
func runUninstall() {
	info, err := service.Inspect(service.ServiceName)
	if err != nil {
		showUninstallError(fmt.Sprintf("Xizmatni tekshirib bo'lmadi: %v", err))
		return
	}
	if !info.Installed {
		walk.MsgBox(nil, uninstallTitle, "Spino24 Guard allaqachon o'rnatilmagan.", walk.MsgBoxIconInformation)
		_ = service.UnregisterUninstaller()
		return
	}

	if walk.MsgBox(nil, uninstallTitle,
		"Spino24 Guard'ni ushbu qurilmadan butunlay o'chirmoqchimisiz?\n\n"+
			"Farzandingiz ekran vaqti va faoliyati endi kuzatilmaydi. Ota-onaga bu haqda "+
			"Telegram orqali xabar boradi.",
		walk.MsgBoxYesNo|walk.MsgBoxIconWarning|walk.MsgBoxDefButton2,
	) != walk.DlgCmdYes {
		return
	}

	// Best-effort: tell the backend first. A network hiccup here must never
	// block the actual removal — a parent clicking Uninstall wants the
	// program gone, not a support ticket about a missed notification.
	if cfg, ok := serviceArgs(info.Args); ok {
		reporter := rules.NewAlertReporter(cfg.baseURL, cfg.deviceID, cfg.deviceSecret)
		ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
		if err := reporter.Report(ctx, "agent_uninstalled", map[string]any{}); err != nil {
			log.Printf("uninstall: parentga xabar berilmadi: %v", err)
		}
		cancel()
	}

	if err := service.Delete(service.ServiceName); err != nil {
		showUninstallError(fmt.Sprintf("Xizmatni o'chirishda xatolik: %v", err))
		return
	}
	if err := service.UnregisterUninstaller(); err != nil {
		log.Printf("uninstall: ro'yxatdan o'chirib bo'lmadi: %v", err)
	}

	walk.MsgBox(nil, uninstallTitle, "Spino24 Guard o'chirildi.", walk.MsgBoxIconInformation)
}

func showUninstallError(message string) {
	walk.MsgBox(nil, uninstallTitle, message, walk.MsgBoxIconError)
}

type serviceConfig struct {
	baseURL      string
	deviceID     string
	deviceSecret string
}

// serviceArgs recovers the -server/-device-id/-device-secret flags the
// service was last configured with (see cmd/installer's `args := []string{
// "-server", ..., "-device-id", ..., "-device-secret", ...}`) so the
// uninstall notification can authenticate as this device without needing
// its own copy of the credentials on disk. ok is false if any of the three
// is missing, in which case the caller skips notifying rather than sending
// a request that can't authenticate anyway.
func serviceArgs(args []string) (serviceConfig, bool) {
	var cfg serviceConfig
	for i := 0; i+1 < len(args); i++ {
		switch args[i] {
		case "-server":
			cfg.baseURL = args[i+1]
		case "-device-id":
			cfg.deviceID = args[i+1]
		case "-device-secret":
			cfg.deviceSecret = args[i+1]
		}
	}
	return cfg, cfg.baseURL != "" && cfg.deviceID != "" && cfg.deviceSecret != ""
}
