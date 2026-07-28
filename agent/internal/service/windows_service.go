//go:build windows

package service

// Cross-compiled for windows/amd64 and type-checks; never run on a real
// Windows machine. Install has never actually registered a service with a
// live SCM, and Run has never actually been driven by one — both are
// straight from the documented golang.org/x/sys/windows/svc / svc/mgr
// usage pattern, not independently verified here. Given the failure mode
// described in this package's doc comment (a "successful" update that
// never actually comes back), treat this file as the single highest-value
// thing to test by hand on a real Windows machine before this ships.

import (
	"context"
	"fmt"
	"os"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

// Install registers exePath as a Windows service named name (auto-start,
// running as SYSTEM by default via the SCM's own defaults), configures it
// with DefaultRecoveryConfig() so the SCM restarts it after an unexpected
// (non-SERVICE_STOPPED) exit — including the one internal/updater
// deliberately triggers after installing a new binary — and starts it
// immediately rather than waiting for the next reboot (StartAutomatic
// alone only governs boot-time startup). If a service with this name
// already exists, its recovery actions are refreshed and it's left running
// rather than failing (so re-running the installer after an upgrade is
// safe); it is not restarted, since args/exePath may have changed and
// that's an update job, not an install job.
func Install(name, displayName, exePath string, args []string) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connecting to service control manager: %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(name)
	if err == nil {
		defer s.Close()
		return applyRecoveryConfig(s)
	}

	s, err = m.CreateService(name, exePath, mgr.Config{
		DisplayName: displayName,
		StartType:   mgr.StartAutomatic,
		Description: "ChaqimchiAI Family — bola qurilmasi monitoring agenti",
	}, args...)
	if err != nil {
		return fmt.Errorf("creating service: %w", err)
	}
	defer s.Close()

	if err := applyRecoveryConfig(s); err != nil {
		return err
	}
	if err := s.Start(); err != nil {
		return fmt.Errorf("starting service: %w", err)
	}
	return nil
}

func applyRecoveryConfig(s *mgr.Service) error {
	cfg := DefaultRecoveryConfig()

	actions := make([]mgr.RecoveryAction, len(cfg.Actions))
	for i, a := range cfg.Actions {
		actionType := windowsActionType(a.Type)
		actions[i] = mgr.RecoveryAction{Type: actionType, Delay: a.Delay}
	}

	if err := s.SetRecoveryActions(actions, cfg.ResetPeriodSeconds()); err != nil {
		return fmt.Errorf("setting recovery actions: %w", err)
	}

	// Without this, the SCM only runs recovery actions for crashes it
	// considers "hard" failures in some configurations; explicitly opting
	// in to treating any non-SERVICE_STOPPED exit as failure-worthy is
	// what makes internal/updater's deliberate abrupt exit reliably
	// trigger a restart rather than being silently ignored.
	if err := s.SetRecoveryActionsOnNonCrashFailures(true); err != nil {
		return fmt.Errorf("enabling recovery on non-crash failures: %w", err)
	}
	return nil
}

func windowsActionType(t RecoveryActionType) int {
	if t == ActionRestart {
		return mgr.ServiceRestart
	}
	return mgr.NoAction
}

// handler adapts a plain run(ctx) func into the svc.Handler the SCM calls.
type handler struct {
	run func(ctx context.Context) error
}

func (h *handler) Execute(args []string, r <-chan svc.ChangeRequest, statusChan chan<- svc.Status) (bool, uint32) {
	const accepted = svc.AcceptStop | svc.AcceptShutdown

	statusChan <- svc.Status{State: svc.StartPending}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- h.run(ctx) }()

	statusChan <- svc.Status{State: svc.Running, Accepts: accepted}

	for {
		select {
		case err := <-done:
			// The wrapped run() returned on its own (shouldn't normally
			// happen — cmd/agent's run() only returns on ctx cancellation
			// or a fatal setup error) rather than via an SCM stop request.
			// Report STOPPED so this counts as the clean case, not a
			// recovery-triggering failure.
			_ = err
			statusChan <- svc.Status{State: svc.Stopped}
			return false, 0
		case req := <-r:
			switch req.Cmd {
			case svc.Interrogate:
				statusChan <- req.CurrentStatus
			case svc.Stop, svc.Shutdown:
				statusChan <- svc.Status{State: svc.StopPending}
				cancel()
				<-done
				statusChan <- svc.Status{State: svc.Stopped}
				return false, 0
			}
		}
	}
}

// Run runs run(ctx) as the named Windows service when launched by the SCM,
// or directly (blocking, no SCM involved) when running interactively —
// e.g. `go run ./cmd/agent` during development, where there is no SCM to
// report status to.
func Run(name string, run func(ctx context.Context) error) error {
	interactive, err := svc.IsAnInteractiveSession()
	if err != nil {
		return fmt.Errorf("checking session type: %w", err)
	}
	if interactive {
		return run(context.Background())
	}
	return svc.Run(name, &handler{run: run})
}

// RestartSelf ends the current process in a way the SCM's failure-recovery
// path will treat as an unexpected stop (see this package's doc comment),
// triggering DefaultRecoveryConfig()'s restart action so the process comes
// back up running whatever binary is now on disk — the intended caller is
// internal/updater immediately after a successful binary swap. This
// intentionally bypasses the handler's normal svc.Status{State: svc.Stopped}
// report — reporting a clean stop is exactly what would tell the SCM "I
// stopped on purpose," which suppresses recovery and defeats the point.
// os.Exit with a non-zero code (not a panic) — a crash-looking stack trace
// in the event log would misrepresent this as a bug rather than an
// intentional update-triggered restart.
func RestartSelf() {
	// A short delay gives any in-flight log line/HTTP response a chance to
	// flush before the process disappears.
	time.Sleep(500 * time.Millisecond)
	os.Exit(1)
}
