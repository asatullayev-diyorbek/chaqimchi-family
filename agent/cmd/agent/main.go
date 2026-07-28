//go:build windows

// cmd/agent is the persistent SYSTEM service binary: it tracks app usage
// and device state, syncs buffered events to the backend, fetches and
// caches rules, and enforces them (block screen + tray warnings). Wires
// together every package built across Bosqich 1-3. Like the rest of the
// Windows-only code in this repo, this has been cross-compiled but never
// run on a real Windows machine — see internal/ui/block_screen.go's note.
package main

import (
	"context"
	"flag"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/rules"
	syncpkg "github.com/chaqimchi/chaqimchi-family/agent/internal/sync"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/tracker"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/ui"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/updater"
)

// version is set at build time via -ldflags "-X main.version=0.4.0". Left
// at "0.0.0-dev" for plain `go build`/`go run`, which always looks
// "outdated" against any published AgentVersion — expected for local dev.
var version = "0.0.0-dev"

func main() {
	baseURL := flag.String("server", "http://localhost:8000", "ChaqimchiAI backend base URL")
	deviceID := flag.String("device-id", os.Getenv("CHAQIMCHI_DEVICE_ID"), "enrolled device id")
	deviceSecret := flag.String("device-secret", os.Getenv("CHAQIMCHI_DEVICE_SECRET"), "device secret")
	dataDir := flag.String("data-dir", `C:\ProgramData\ChaqimchiFamily`, "local data directory")
	flag.Parse()

	if *deviceID == "" || *deviceSecret == "" {
		log.Fatal("device-id and device-secret are required (flags or CHAQIMCHI_DEVICE_ID/CHAQIMCHI_DEVICE_SECRET)")
	}

	if err := os.MkdirAll(*dataDir, 0o755); err != nil {
		log.Fatalf("creating data dir: %v", err)
	}

	store, err := buffer.Open(filepath.Join(*dataDir, "buffer.db"))
	if err != nil {
		log.Fatalf("opening buffer: %v", err)
	}
	defer store.Close()

	rulesCache, err := rules.OpenCache(filepath.Join(*dataDir, "rules.db"))
	if err != nil {
		log.Fatalf("opening rules cache: %v", err)
	}
	defer rulesCache.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	tray := ui.NewTray()

	reporter := rules.NewAlertReporter(*baseURL, *deviceID, *deviceSecret)
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

	fetcher := rules.NewFetcher(*baseURL, *deviceID, *deviceSecret, rulesCache)
	go fetcher.Run(ctx, 5*time.Minute)

	uploader := syncpkg.NewUploader(*baseURL, *deviceID, *deviceSecret, store)
	go uploader.Run(ctx, 60*time.Second)

	go tracker.RunDeviceInfo(ctx, store, 60*time.Second)

	// Unsigned, internal dev-cycle auto-update — see internal/updater's
	// package doc for why there's no signature check here on purpose, and
	// why that's explicitly NOT acceptable as-is once this ships to real
	// families (Bosqich 6 adds verification + safe rollback).
	versionChecker := updater.NewChecker(*baseURL, *deviceID, *deviceSecret, version)
	go versionChecker.Run(ctx, 6*time.Hour,
		func(latest *updater.LatestVersion) {
			log.Printf("updater: %s available (current %s), installing", latest.Version, version)
			if err := updater.Update(ctx, nil, latest.BinaryURL); err != nil {
				log.Printf("updater: install failed, staying on %s: %v", version, err)
				return
			}
			log.Printf("updater: installed %s, exiting so the service can restart into it", latest.Version)
			os.Exit(0)
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
	// run it last, blocking, as the process's main loop.
	tray.Run()
}
