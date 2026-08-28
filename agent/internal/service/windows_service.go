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
	"syscall"
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
// already exists, its executable path and arguments are updated and the
// service is restarted so a re-install can switch it to the newly enrolled
// device instead of silently continuing with stale credentials.
func Install(name, displayName, exePath string, args []string) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connecting to service control manager: %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(name)
	if err == nil {
		defer s.Close()
		// Keep upgrades visible under the current product name without
		// creating a second service beside an older development install.
		current, configErr := s.Config()
		if configErr != nil {
			return fmt.Errorf("reading existing service config: %w", configErr)
		}
		current.BinaryPathName = serviceCommandLine(exePath, args)
		current.StartType = mgr.StartAutomatic
		current.DisplayName = displayName
		current.Description = "ChaqimchiAI Guard — bola qurilmasi monitoring agenti"
		if err := s.UpdateConfig(current); err != nil {
			return fmt.Errorf("updating existing service config: %w", err)
		}
		if err := applyRecoveryConfig(s); err != nil {
			return err
		}
		if err := restart(s); err != nil {
			return fmt.Errorf("restarting existing service: %w", err)
		}
		return nil
	}

	s, err = m.CreateService(name, exePath, mgr.Config{
		DisplayName: displayName,
		StartType:   mgr.StartAutomatic,
		Description: "ChaqimchiAI Guard — bola qurilmasi monitoring agenti",
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

func serviceCommandLine(exePath string, args []string) string {
	command := syscall.EscapeArg(exePath)
	for _, arg := range args {
		command += " " + syscall.EscapeArg(arg)
	}
	return command
}

func restart(s *mgr.Service) error {
	status, err := s.Query()
	if err != nil {
		return fmt.Errorf("querying service status: %w", err)
	}
	if status.State != svc.Stopped {
		if _, err := s.Control(svc.Stop); err != nil {
			return fmt.Errorf("stopping service: %w", err)
		}
		deadline := time.Now().Add(30 * time.Second)
		for time.Now().Before(deadline) {
			status, err = s.Query()
			if err != nil {
				return fmt.Errorf("waiting for service stop: %w", err)
			}
			if status.State == svc.Stopped {
				break
			}
			time.Sleep(200 * time.Millisecond)
		}
		if status.State != svc.Stopped {
			return fmt.Errorf("service did not stop within 30 seconds")
		}
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
	run func(ctx context.Context, interactive bool) error
}

func (h *handler) Execute(args []string, r <-chan svc.ChangeRequest, statusChan chan<- svc.Status) (bool, uint32) {
	const accepted = svc.AcceptStop | svc.AcceptShutdown

	statusChan <- svc.Status{State: svc.StartPending}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- h.run(ctx, false) }()

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

// Run runs run(ctx, interactive) as the named Windows service when launched
// by the SCM (interactive=false), or directly (blocking, no SCM involved)
// when running interactively (interactive=true) — e.g. `go run ./cmd/agent`
// during development, where there is no SCM to report status to. cmd/agent
// uses the flag to decide whether foreground tracking can run in-process
// (interactive) or must be delegated to a session helper (service).
func Run(name string, run func(ctx context.Context, interactive bool) error) error {
	interactive, err := svc.IsAnInteractiveSession()
	if err != nil {
		return fmt.Errorf("checking session type: %w", err)
	}
	if interactive {
		return run(context.Background(), true)
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
