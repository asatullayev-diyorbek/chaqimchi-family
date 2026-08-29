//go:build windows

// cmd/agent is the persistent SYSTEM service binary: it tracks app usage
// and device state, syncs buffered events to the backend, fetches and
// caches rules, and records rule/status events. Wires together every package built across
// Bosqich 1-4.5. As of Bosqich 4.5 it actually runs under the Windows
// Service Control Manager (via internal/service.Run) instead of as a bare
// console process.
//
// When run under the SCM it lives in session 0 and can't see the
// interactive foreground window, so it launches a copy of itself with
// -foreground-reporter into the active console session (internal/session)
// and consumes that stream instead of polling directly.
package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/endpoint"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/rules"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/service"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/session"
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
	foregroundReporter := flag.Bool("foreground-reporter", false, "internal: run only the session-side foreground probe (launched by the service)")
	parentPID := flag.Int("parent-pid", 0, "internal: exit when this process id is gone (used with -foreground-reporter)")
	flag.Parse()

	if *foregroundReporter {
		runForegroundReporter(*parentPID)
		return
	}

	if *deviceID == "" || *deviceSecret == "" {
		log.Fatal("device-id and device-secret are required (flags or CHAQIMCHI_DEVICE_ID/CHAQIMCHI_DEVICE_SECRET)")
	}
	if err := endpoint.ValidateBackendURL(*baseURL, *allowInsecureHTTP); err != nil {
		log.Fatalf("backend URL rejected: %v", err)
	}

	err := service.Run(service.ServiceName, func(ctx context.Context, interactive bool) error {
		return run(ctx, *baseURL, *deviceID, *deviceSecret, *dataDir, interactive)
	})
	if err != nil {
		log.Fatalf("service: %v", err)
	}
}

// run holds everything that used to live directly in main() before
// Bosqich 4.5. It's now a plain func(ctx) error so internal/service.Run can
// drive it either directly (interactive/dev) or as an SCM-managed service,
// identically.
func run(ctx context.Context, baseURL, deviceID, deviceSecret, dataDir string, interactive bool) error {
	startedAt := time.Now().UTC().Format(time.RFC3339)

	// In service (session 0) mode the foreground probe runs in a helper
	// process in the user's session and reports app names — and, the first
	// time it sees each app, that app's extracted icon — here.
	var foregroundCh chan string
	var iconCh chan localipc.AppIconReport
	if !interactive {
		foregroundCh = make(chan string, 8)
		iconCh = make(chan localipc.AppIconReport, 8)
	}
	go func() {
		if err := localipc.Serve(ctx, func() localipc.Status {
			return localipc.Status{
				Service: "running", Version: version, StartedAt: startedAt,
				Monitoring: []string{"Ekran vaqti", "Ilova nomlari", "Qurilma holati"},
				RecentLogs: []string{"Service Started: " + startedAt, "Automatic updates: disabled until signed-update support"},
			}
		}, foregroundCh, iconCh); err != nil && ctx.Err() == nil {
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

	onPoll := func(app string) {
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
	}

	if interactive {
		go tracker.RunAppUsage(ctx, store, pollInterval, onPoll)
	} else {
		// Session 0: poll from a helper in the active console session.
		if exe, exeErr := os.Executable(); exeErr == nil {
			go session.RunReporter(ctx, exe)
		} else {
			log.Printf("cannot locate own executable for session reporter: %v", exeErr)
		}
		go tracker.RunAppUsageFromObservations(ctx, store, foregroundCh, onPoll)
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case rep := <-iconCh:
					tracker.AppendIconEvent(store, rep.AppID, rep.SHA256, rep.PNGB64)
				}
			}
		}()
	}

	<-ctx.Done()
	return ctx.Err()
}

// runForegroundReporter is the -foreground-reporter mode: a tiny loop that
// runs in the interactive user session (launched by internal/session),
// polls the real foreground window and POSTs it to the service's local IPC.
// It carries no device credentials and touches nothing but loopback.
//
// Lifetime: internal/session.RunReporter terminates this child on graceful
// service stop and on console-session change. As a backstop for an abrupt
// service kill, the loop also exits after maxConsecFails consecutive POST
// failures — long enough (~2 min) to ride out the service's own 5s/5s/30s
// recovery restarts without dropping the reporter. (parentPID is accepted
// for diagnostic context only: a user-session process cannot reliably
// OpenProcess a SYSTEM service to poll its liveness — "Access is denied".)
func runForegroundReporter(parentPID int) {
	const (
		pollInterval   = 10 * time.Second
		endpointURL    = "http://" + localipc.Address + "/v1/foreground"
		maxConsecFails = 12
	)
	_ = parentPID
	// A dedicated transport with no environment proxy: this is loopback IPC
	// and must never be routed anywhere.
	client := &http.Client{Timeout: 3 * time.Second, Transport: &http.Transport{}}
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()
	fails := 0

	// Icons are extracted once per exe path, then attached to the report for
	// the matching app until one POST succeeds carrying them (the service
	// acks with 2xx). A fresh reporter re-extracts, and the backend dedupes
	// by sha256, so an occasional lost icon is self-healing.
	type iconPayload struct{ sha, b64 string }
	extracted := map[string]bool{}
	pendingIcons := map[string]iconPayload{}

	for range ticker.C {
		name, path := tracker.ForegroundProcessInfo()
		report := localipc.ForegroundReport{App: name}
		if name != "" && path != "" && !extracted[path] {
			extracted[path] = true
			if pngBytes, sha, iconErr := tracker.ExtractIconPNG(path); iconErr == nil && len(pngBytes) > 0 {
				pendingIcons[name] = iconPayload{sha: sha, b64: base64.StdEncoding.EncodeToString(pngBytes)}
			}
		}
		if ic, ok := pendingIcons[name]; ok {
			report.IconAppID, report.IconSHA256, report.IconPNGB64 = name, ic.sha, ic.b64
		}

		body, _ := json.Marshal(report)
		req, err := http.NewRequest(http.MethodPost, endpointURL, bytes.NewReader(body))
		if err != nil {
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil {
			if fails++; fails >= maxConsecFails {
				return
			}
			continue
		}
		resp.Body.Close()
		if resp.StatusCode/100 == 2 && report.IconAppID != "" {
			delete(pendingIcons, report.IconAppID)
		}
		fails = 0
	}
}
