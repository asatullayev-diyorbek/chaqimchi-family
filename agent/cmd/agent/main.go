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
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/endpoint"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/rules"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/service"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/session"
	syncpkg "github.com/chaqimchi/chaqimchi-family/agent/internal/sync"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/tracker"
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
	allowInsecureHTTP := flag.Bool("allow-insecure-http", false, "development only: allow a non-HTTPS backend URL")
	foregroundReporter := flag.Bool("foreground-reporter", false, "internal: run only the session-side foreground probe (launched by the service)")
	parentPID := flag.Int("parent-pid", 0, "internal: exit when this process id is gone (used with -foreground-reporter)")
	selfTest := flag.Bool("selftest", false, "internal: print version and exit 0 (OTA pre-swap smoke test)")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *selfTest || *showVersion {
		fmt.Println(version)
		return
	}
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
	// Live status shared with the local IPC endpoint (and through it the
	// tray status window). Updated from the poll loop and the uploader.
	var (
		statusMu       sync.Mutex
		statusToday    float64
		statusLimit    int
		statusLastSync string
		statusOnline   bool
	)
	setLastSync := func() {
		statusMu.Lock()
		statusLastSync = time.Now().UTC().Format(time.RFC3339)
		statusOnline = true
		statusMu.Unlock()
	}

	// The user-session tray calls POST /v1/adult-access just before it opens
	// the local "Kattalar uchun" panel. The child cannot see this panel
	// without the parent being told: we turn it into a normal alert, which
	// the backend also forwards to Telegram.
	alertReporter := rules.NewAlertReporter(baseURL, deviceID, deviceSecret)
	onAdultAccess := func(reason string) {
		if reason == "" {
			reason = "tray"
		}
		go func() {
			nctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
			defer cancel()
			if err := alertReporter.Report(nctx, "settings_panel_access", map[string]any{"source": reason}); err != nil {
				log.Printf("adult-panel access alert: %v", err)
			}
		}()
	}

	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return fmt.Errorf("creating data dir: %w", err)
	}

	// A windowsgui service has no console, so log.* would otherwise vanish.
	// Send it to a capped file next to the buffer so a parent can retrieve
	// it when something (e.g. missing app icons) needs diagnosing.
	if !interactive {
		logPath := filepath.Join(dataDir, "agent.log")
		if fi, statErr := os.Stat(logPath); statErr == nil && fi.Size() > 4<<20 {
			_ = os.Truncate(logPath, 0)
		}
		if lf, logErr := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644); logErr == nil {
			log.SetOutput(lf)
		}
	}
	log.Printf("agent %s starting (interactive=%v)", version, interactive)

	store, err := buffer.Open(filepath.Join(dataDir, "buffer.db"))
	if err != nil {
		return fmt.Errorf("opening buffer: %w", err)
	}
	defer store.Close()

	// Buffer one agent lifecycle event (update applied / rolled back) so the
	// parent dashboard can show it; flows out with the next sync.
	reportAgentEvent := func(eventType, detail string) {
		payload, _ := json.Marshal(map[string]any{"type": eventType, "detail": detail, "version": version})
		store.Append(buffer.Event{ID: uuid.NewString(), Type: eventType, Payload: payload, CreatedAt: time.Now()})
	}

	// OTA state machine: confirm a freshly-swapped binary or roll back a bad
	// one. ErrRolledBack means we've restored the previous exe and must exit
	// so the service manager starts it.
	if err := updater.ResolvePending(dataDir, version, reportAgentEvent); err != nil {
		if errors.Is(err, updater.ErrRolledBack) {
			log.Printf("update rolled back to previous binary; exiting for restart")
			return nil
		}
		log.Printf("resolving pending update: %v", err)
	}

	rulesCache, err := rules.OpenCache(filepath.Join(dataDir, "rules.db"))
	if err != nil {
		return fmt.Errorf("opening rules cache: %w", err)
	}
	defer rulesCache.Close()

	enforcer := rules.NewEnforcer(rulesCache, alertReporter,
		func(reason, message string) {
			// The Windows service is Session 0 and must never draw a user
			// interface. The block overlay itself is raised in the user
			// session by cmd/desktop, off the level-triggered
			// enforcer.ActiveBlock() state published on the local IPC
			// status below; this edge callback keeps the audit trail.
			log.Printf("rule triggered (%s): %s", reason, message)
		},
		func(message string) {
			log.Printf("rule notification: %s", message)
		},
	)

	// The local IPC status endpoint is what the user-session Desktop app
	// reads — for the tray status window and, now, the block overlay. Served
	// only once the enforcer exists so status() can report ActiveBlock().
	go func() {
		if err := localipc.Serve(ctx, func() localipc.Status {
			statusMu.Lock()
			today, limit, lastSync, online := int(statusToday), statusLimit, statusLastSync, statusOnline
			statusMu.Unlock()
			s := localipc.Status{
				Service: "running", Version: version, StartedAt: startedAt,
				LastSyncAt: lastSync, Online: online,
				TodayMinutes: today, DailyLimitMinutes: limit,
				Monitoring: []string{"Ekran vaqti", "Ilova nomlari", "Qurilma holati"},
				RecentLogs: []string{"Service Started: " + startedAt, "Automatic updates: disabled until signed-update support"},
			}
			if reason, message, blocked := enforcer.ActiveBlock(); blocked {
				s.Block = &localipc.BlockDirective{Reason: reason, Message: message}
			}
			return s
		}, foregroundCh, iconCh, onAdultAccess); err != nil && ctx.Err() == nil {
			log.Printf("local desktop IPC: %v", err)
		}
	}()

	fetcher := rules.NewFetcher(baseURL, deviceID, deviceSecret, rulesCache)
	go fetcher.Run(ctx, 5*time.Minute)

	uploader := syncpkg.NewUploader(baseURL, deviceID, deviceSecret, store)
	uploader.AgentVersion = version
	uploader.OnSuccess = func() {
		updater.ConfirmHealthy(dataDir, version, reportAgentEvent)
		setLastSync()
	}
	go uploader.Run(ctx, 60*time.Second)

	go tracker.RunDeviceInfo(ctx, store, 60*time.Second)

	// OTA updates: every binary is Ed25519-verified against a pinned key and
	// smoke-tested before the swap; a bad one is rolled back on next start
	// (internal/updater). Updates are silent by design — a guardian the
	// child cannot block — and the parent sees the version on the dashboard.
	updChecker := updater.NewChecker(baseURL, deviceID, deviceSecret, version)
	go updChecker.Run(ctx, 6*time.Hour,
		func(lv *updater.LatestVersion) {
			log.Printf("update available: %s -> %s", version, lv.Version)
			if err := updater.Apply(ctx, lv, version, dataDir); err != nil {
				log.Printf("applying update %s: %v", lv.Version, err)
				return
			}
			log.Printf("update %s staged and swapped; stopping for service restart", lv.Version)
			service.RestartSelf()
		},
		func(err error) { log.Printf("update check: %v", err) },
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
		enforcer.CheckBlockedWindow(ctx)

		limit := 0
		if m, ok := enforcer.DailyLimitMinutes(); ok {
			limit = int(m)
		}
		statusMu.Lock()
		statusToday, statusLimit = todayMinutes, limit
		statusMu.Unlock()
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
					log.Printf("icon received from session helper: %s (%d b64 chars)", rep.AppID, len(rep.PNGB64))
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
// reporterLogPath is where the session helper writes its diagnostic line —
// per-user, always writable, and easy for a parent to find and send back.
func reporterLogPath() string {
	if dir, err := os.UserCacheDir(); err == nil {
		return filepath.Join(dir, "ChaqimchiFamily", "reporter.log")
	}
	return filepath.Join(os.TempDir(), "chaqimchi-reporter.log")
}

// reporterLog appends one timestamped line to the helper's log, truncating
// first if it has grown past ~1 MB. Best-effort: a logging failure is never
// allowed to disturb the reporter loop.
func reporterLog(format string, args ...any) {
	p := reporterLogPath()
	_ = os.MkdirAll(filepath.Dir(p), 0o755)
	if fi, err := os.Stat(p); err == nil && fi.Size() > 1<<20 {
		_ = os.Truncate(p, 0)
	}
	f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s  %s\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, args...))
}

func runForegroundReporter(parentPID int) {
	const (
		pollInterval   = 10 * time.Second
		endpointURL    = "http://" + localipc.Address + "/v1/foreground"
		maxConsecFails = 12
	)
	_ = parentPID
	reporterLog("foreground reporter started")
	// SHGetFileInfo(SHGFI_ICON) needs a COM apartment on the calling thread;
	// this helper has no message pump, so without it every icon extraction
	// returns a null HICON. Do it once here and keep this goroutine alive.
	tracker.InitShellCOM()

	// A dedicated transport with no environment proxy: this is loopback IPC
	// and must never be routed anywhere.
	client := &http.Client{Timeout: 3 * time.Second, Transport: &http.Transport{}}
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()
	fails := 0

	// Icons are attached to the report for the matching app until one POST
	// succeeds carrying them (the service acks 2xx), then dropped. Extraction
	// is retried a few times per exe before giving up — the first attempt can
	// land before the shell is ready. The backend dedupes by sha256.
	type iconPayload struct{ sha, b64 string }
	const maxIconAttempts = 4
	iconAttempts := map[string]int{}
	pendingIcons := map[string]iconPayload{}

	for range ticker.C {
		name, path := tracker.ForegroundProcessInfo()
		report := localipc.ForegroundReport{App: name}
		if name != "" && path != "" && iconAttempts[path] < maxIconAttempts {
			if _, have := pendingIcons[name]; !have {
				iconAttempts[path]++
				pngBytes, sha, iconErr := tracker.ExtractIconPNG(path)
				if iconErr == nil && len(pngBytes) > 0 {
					pendingIcons[name] = iconPayload{sha: sha, b64: base64.StdEncoding.EncodeToString(pngBytes)}
					reporterLog("icon extracted: %s (%d bytes)", name, len(pngBytes))
				} else if iconAttempts[path] >= maxIconAttempts {
					reporterLog("icon extraction gave up for %s: %v", path, iconErr)
				}
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
