//go:build windows

// cmd/agent is the persistent SYSTEM service binary: it tracks app usage
// and device state, syncs buffered events to the backend, fetches and
// caches rules, and records rule/status events. Wires together every package built across
// Bosqich 1-4.5. As of Bosqich 4.5 it actually runs under the Windows
// Service Control Manager (via internal/service.Run) instead of as a bare
// console process. Like
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
	"github.com/chaqimchi/chaqimchi-family/agent/internal/endpoint"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/rules"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/service"
	syncpkg "github.com/chaqimchi/chaqimchi-family/agent/internal/sync"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/tracker"
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
	allowInsecureHTTP := flag.Bool("allow-insecure-http", false, "development only: allow a non-HTTPS backend URL")
	flag.Parse()

	if *deviceID == "" || *deviceSecret == "" {
		log.Fatal("device-id and device-secret are required (flags or CHAQIMCHI_DEVICE_ID/CHAQIMCHI_DEVICE_SECRET)")
	}
	if err := endpoint.ValidateBackendURL(*baseURL, *allowInsecureHTTP); err != nil {
		log.Fatalf("backend URL rejected: %v", err)
	}

	err := service.Run(service.ServiceName, func(ctx context.Context) error {
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
	startedAt := time.Now().UTC().Format(time.RFC3339)
	go func() {
		if err := localipc.Serve(ctx, func() localipc.Status {
			return localipc.Status{
				Service: "running", Version: version, StartedAt: startedAt,
				Monitoring: []string{"Ekran vaqti", "Ilova nomlari", "Qurilma holati"},
				RecentLogs: []string{"Service Started: " + startedAt, "Automatic updates: disabled until signed-update support"},
			}
		}); err != nil && ctx.Err() == nil {
			log.Printf("local desktop IPC: %v", err)
		}
	}()
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

	reporter := rules.NewAlertReporter(baseURL, deviceID, deviceSecret)
	enforcer := rules.NewEnforcer(rulesCache, reporter,
		func(reason, message string) {
			// The Windows service is Session 0 and must never draw a user
			// interface. The future desktop helper receives these visible
			// notices through a documented local IPC channel. Until it is
			// shipped, retain the audit/reporting path without a hidden UI.
			log.Printf("rule triggered (%s): %s", reason, message)
		},
		func(message string) {
			log.Printf("rule notification: %s", message)
		},
	)

	fetcher := rules.NewFetcher(baseURL, deviceID, deviceSecret, rulesCache)
	go fetcher.Run(ctx, 5*time.Minute)

	uploader := syncpkg.NewUploader(baseURL, deviceID, deviceSecret, store)
	go uploader.Run(ctx, 60*time.Second)

	go tracker.RunDeviceInfo(ctx, store, 60*time.Second)

	// Remote update code deliberately remains disabled. A public release may
	// enable it only after Authenticode signature + hash verification, explicit
	// user consent and rollback are implemented (Windows Security & Trust).
	log.Printf("agent %s started; automatic updates are disabled pending signed-update support", version)

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

	<-ctx.Done()
	return ctx.Err()
}
