//go:build windows

package main

// Cross-compiled and type-checked only — see internal/service/
// windows_service.go's doc comment. Invoked every 15 minutes by the
// Scheduled Task internal/service.RegisterWatchdogTask creates, as a
// backstop alongside the SCM's own failure-recovery actions (see
// recovery.go's doc comment for exactly what those do and don't cover).

import (
	"context"
	"log"
	"time"

	"spino24agent/internal/rules"
	"spino24agent/internal/service"
)

// runWatchdogCheck is a one-shot check-and-fix, not a loop: the Scheduled
// Task itself provides the "every 15 minutes" cadence, so this exits as
// soon as it's done rather than sitting around as its own background
// process.
func runWatchdogCheck(baseURL, deviceID, deviceSecret string) {
	info, err := service.Inspect(service.ServiceName)
	if err != nil {
		log.Printf("watchdog: inspecting service: %v", err)
		return
	}

	if !info.Installed {
		// The service registration itself is gone — the deepest tamper
		// case (well past a graceful `sc stop`, which authorize_stop_
		// windows.go's marker already refuses, or a crash/kill, which the
		// SCM's own recovery actions already catch). A scheduled task
		// alone can't safely reconstruct a full service registration from
		// nothing, so this only reports it — a human needs to re-run the
		// installer. Best-effort: if this exe was invoked with expired or
		// missing credentials there's nothing to authenticate the report
		// with either, and that's fine — silently doing nothing beats
		// guessing.
		if baseURL != "" && deviceID != "" && deviceSecret != "" {
			reporter := rules.NewAlertReporter(baseURL, deviceID, deviceSecret)
			ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
			if err := reporter.Report(ctx, "agent_uninstalled", map[string]any{"detected_by": "watchdog"}); err != nil {
				log.Printf("watchdog: reporting missing service: %v", err)
			}
			cancel()
		}
		return
	}

	if !info.Running {
		if err := service.Start(service.ServiceName); err != nil {
			log.Printf("watchdog: restarting stopped service: %v", err)
		}
	}
}
