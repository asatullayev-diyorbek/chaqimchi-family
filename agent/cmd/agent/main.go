//go:build windows

// cmd/agent is the persistent SYSTEM service binary: it tracks app usage
// and device state, syncs buffered events to the backend, fetches and
// caches rules, and enforces them (block screen + tray warnings), and
// checks for/applies updates. Wires together every package built across
// Bosqich 1-4.5. As of Bosqich 4.5 it actually runs under the Windows
// Service Control Manager (via internal/service.Run) instead of as a bare
// console process — see internal/service's package doc for why that
// matters specifically for the updater's restart-on-exit mechanism. Like
// the rest of the Windows-only code in this repo, this has been
// cross-compiled but never run on a real Windows machine.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/rules"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/service"
	syncpkg "github.com/chaqimchi/chaqimchi-family/agent/internal/sync"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/tracker"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/updater"
)

// version is set at build time via -ldflags "-X main.version=0.4.0". Left
// at "0.0.0-dev" for plain `go build`/`go run`, which always looks
// "outdated" against any published AgentVersion — expected for local dev.
var version = "0.0.0-dev"

const serviceName = "ChaqimchiFamilyAgent"

func main() {
	baseURL := flag.String("server", "http://localhost:8000", "ChaqimchiAI backend base URL")
	deviceID := flag.String("device-id", os.Getenv("CHAQIMCHI_DEVICE_ID"), "enrolled device id")
	deviceSecret := flag.String("device-secret", os.Getenv("CHAQIMCHI_DEVICE_SECRET"), "device secret")
	dataDir := flag.String("data-dir", `C:\ProgramData\ChaqimchiFamily`, "local data directory")
	flag.Parse()

	if *deviceID == "" || *deviceSecret == "" {
		log.Fatal("device-id and device-secret are required (flags or CHAQIMCHI_DEVICE_ID/CHAQIMCHI_DEVICE_SECRET)")
	}

	err := service.Run(serviceName, func(ctx context.Context) error {
		return run(ctx, *baseURL, *deviceID, *deviceSecret, *dataDir)
	})
	if err != nil {
		log.Fatalf("service: %v", err)
	}
}

// run holds everything that used to live directly in main() before
// Bosqich 4.5. It's now a plain func(ctx) error so internal/service.Run can
// drive it either directly (interactive/dev) or as an SCM-managed service,
// identically.
func run(ctx context.Context, baseURL, deviceID, deviceSecret, dataDir string) error {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return fmt.Errorf("creating data dir: %w", err)
	}

	store, err := buffer.Open(filepath.Join(dataDir, "buffer.db"))
	if err != nil {
		return fmt.Errorf("opening buffer: %w", err)
	}
	defer store.Close()

	rulesCache, err := rules.OpenCache(filepath.Join(dataDir, "rules.db"))
	if err != nil {
		return fmt.Errorf("opening rules cache: %w", err)
	}
	defer rulesCache.Close()

	tray := ui.NewTray()
	go func() {
		<-ctx.Done()
		tray.Quit()
	}()

	reporter := rules.NewAlertReporter(baseURL, deviceID, deviceSecret)
	enforcer := rules.NewEnforcer(rulesCache, reporter,
		func(reason, message string) {
			tray.SetStatus(ui.StatusWarning)
			go ui.BlockScreen(message)
		},
		func(message string) {
			tray.SetStatus(ui.StatusWarning)
			tray.Notify(message)
		},
	)

	fetcher := rules.NewFetcher(baseURL, deviceID, deviceSecret, rulesCache)
	go fetcher.Run(ctx, 5*time.Minute)

	uploader := syncpkg.NewUploader(baseURL, deviceID, deviceSecret, store)
	go uploader.Run(ctx, 60*time.Second)

	go tracker.RunDeviceInfo(ctx, store, 60*time.Second)

	// Unsigned, internal dev-cycle auto-update — see internal/updater's
	// package doc for why there's no signature check here on purpose, and
	// why that's explicitly NOT acceptable as-is once this ships to real
	// families (Bosqich 6 adds verification + safe rollback).
	versionChecker := updater.NewChecker(baseURL, deviceID, deviceSecret, version)
	go versionChecker.Run(ctx, 6*time.Hour,
		func(latest *updater.LatestVersion) {
			log.Printf("updater: %s available (current %s), installing", latest.Version, version)
			if err := updater.Update(ctx, nil, latest.BinaryURL); err != nil {
				log.Printf("updater: install failed, staying on %s: %v", version, err)
				return
			}
			log.Printf("updater: installed %s, restarting to run it", latest.Version)
			// Deliberately not a graceful return/ctx-cancel — see
			// RestartSelf's doc comment for why this has to look like an
			// unexpected stop to the SCM, not a clean one.
			service.RestartSelf()
		},
		func(err error) { log.Printf("updater: check failed: %v", err) },
	)

	// Daily total is kept as a simple in-memory counter, incremented by
	// one poll interval whenever a foreground app was observed, reset at
	// UTC midnight — driven off the same tick as app_usage tracking so
	// CheckDailyLimit runs without a second timer. This approximates true
	// usage well at a 10s poll interval; it does not reconcile against the
	// buffer's actual stored app_usage durations.
	const pollInterval = 10 * time.Second
	var todayMinutes float64
	var trackedDate string

	go tracker.RunAppUsage(ctx, store, pollInterval, func(app string) {
		today := time.Now().UTC().Format("2006-01-02")
		if trackedDate != today {
			trackedDate = today
			todayMinutes = 0
		}
		if app != "" {
			todayMinutes += pollInterval.Minutes()
		}

		enforcer.CheckForegroundApp(ctx, app)
		enforcer.CheckDailyLimit(ctx, todayMinutes)
	})

	// systray wants to own the main thread/goroutine on some platforms —
	// run it last, blocking until either the tray's own "Chiqish" menu
	// item or ctx cancellation (from an SCM stop request) calls Quit().
	tray.Run()
	return nil
}
