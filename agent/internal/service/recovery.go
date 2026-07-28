// Package service is the missing link between internal/updater swapping a
// new binary into place and that binary actually ending up running: it
// installs the agent as a Windows service with failure-recovery actions
// configured, and wraps cmd/agent's real work so it runs under the Service
// Control Manager (SCM) instead of as a bare console process.
//
// Why this matters more than the other Windows-only gaps in this repo: per
// the x/sys/windows/svc/mgr docs, "a service is considered failed when it
// terminates without reporting a status of SERVICE_STOPPED to the service
// controller." internal/updater deliberately exits the process abruptly
// after installing a new binary specifically so the SCM treats that exit as
// a failure and applies the recovery action below (restart) — which is what
// actually gets the new binary running. If the recovery-action config here
// is wrong, or the process was never running under the SCM in the first
// place (e.g. someone runs the .exe directly instead of installing it as a
// service), the update silently "succeeds" on the wire and then the agent
// just... doesn't come back. That failure mode is invisible from the
// server's side, which is what makes this link more important than a
// typical unverified Windows-only piece — see this package's tests.go /
// windows_service.go doc comments for exactly what has and hasn't been
// checked.
package service

import "time"

type RecoveryActionType int

const (
	// ActionRestart tells the SCM to relaunch the service.
	ActionRestart RecoveryActionType = iota
	// ActionNone tells the SCM to do nothing for that failure.
	ActionNone
)

type RecoveryAction struct {
	Type  RecoveryActionType
	Delay time.Duration
}

// RecoveryConfig is a Windows-independent description of what the SCM
// should do when the service process stops without a clean SERVICE_STOPPED
// handshake. windows_service.go translates this into the actual
// mgr.RecoveryAction/SetRecoveryActions call — kept as a separate,
// dependency-free type specifically so the config values themselves (not
// the syscalls) can be unit tested without a Windows machine.
type RecoveryConfig struct {
	// ResetPeriod is how long the service must run failure-free before the
	// SCM's failure counter resets to zero.
	ResetPeriod time.Duration
	// Actions apply in order to the 1st, 2nd, 3rd... failure since the
	// last reset; the SCM repeats the final entry for any failure beyond
	// the list's length.
	Actions []RecoveryAction
}

// DefaultRecoveryConfig is what Install applies: restart quickly on the
// first two failures (an update-triggered exit should recover in seconds),
// then back off, and forgive old failures after a day of stable running so
// a single flaky night doesn't count against a healthy agent forever.
func DefaultRecoveryConfig() RecoveryConfig {
	return RecoveryConfig{
		ResetPeriod: 24 * time.Hour,
		Actions: []RecoveryAction{
			{Type: ActionRestart, Delay: 5 * time.Second},
			{Type: ActionRestart, Delay: 5 * time.Second},
			{Type: ActionRestart, Delay: 30 * time.Second},
		},
	}
}

// ResetPeriodSeconds converts ResetPeriod to the whole-second unit the Win32
// API (and x/sys/windows/svc/mgr.SetRecoveryActions) actually takes.
func (c RecoveryConfig) ResetPeriodSeconds() uint32 {
	return uint32(c.ResetPeriod / time.Second)
}
