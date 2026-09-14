//go:build windows

package service

// Cross-compiled and type-checked only (see windows_service.go). A backstop
// alongside recovery.go's SCM failure-recovery actions: those only fire
// when the service *process* dies unexpectedly (crash, `taskkill /F`) —
// they do nothing if the service is registered but simply not running for
// some other reason, or if the recovery actions' own failure count has
// already been exhausted since the last ResetPeriod. A periodic Scheduled
// Task, run as SYSTEM independently of the service itself, re-checks and
// restarts it regardless of why it stopped.
//
// A Scheduled Task rather than a second always-running watchdog process:
// no extra background process burning memory on a family's machine around
// the clock for a check that only needs to run every few minutes, and
// `schtasks.exe` is a stable, well-documented Windows tool rather than
// another surface of raw Win32 API calls to get right without a way to
// test them.

import (
	"fmt"
	"os/exec"
)

// WatchdogTaskName is the Scheduled Task name Task Scheduler shows it
// under. Not hidden — same "not secret, just resilient" posture as
// ServiceName.
const WatchdogTaskName = "ChaqimchiGuardWatchdog"

// RegisterWatchdogTask creates (or replaces) the SYSTEM-run task, firing
// every 15 minutes. commandLine is the full "<agent exe> -watchdog-check
// -server ... -device-id ... -device-secret ..." invocation, already
// quoted/escaped as a shell command line.
func RegisterWatchdogTask(commandLine string) error {
	cmd := exec.Command("schtasks", "/Create", "/F",
		"/SC", "MINUTE", "/MO", "15",
		"/TN", WatchdogTaskName,
		"/TR", commandLine,
		"/RU", "SYSTEM",
		"/RL", "HIGHEST",
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("schtasks /Create: %w (%s)", err, out)
	}
	return nil
}

// UnregisterWatchdogTask removes the scheduled task. Best-effort: schtasks
// exits non-zero when the task doesn't exist, which isn't worth surfacing
// as an error to a caller that's just making sure it's gone.
func UnregisterWatchdogTask() {
	_ = exec.Command("schtasks", "/Delete", "/F", "/TN", WatchdogTaskName).Run()
}
