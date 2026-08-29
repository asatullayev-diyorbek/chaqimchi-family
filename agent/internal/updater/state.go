package updater

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// Update lifecycle, tracked in <dataDir>/update.json so a restarted service
// (the new binary, or a rolled-back old one) knows where it is:
//
//	(none)        no update in flight
//	staged        new binary verified + smoke-tested, not yet swapped
//	swapped       binary swapped in; service exiting for SCM to restart it
//	probing       new binary is running, waiting to confirm it's healthy
//	confirmed     new binary reported healthy; old binary can be deleted
//	rolledback    new binary failed; old binary restored, running again
const (
	stageStaged     = "staged"
	stageSwapped    = "swapped"
	stageProbing    = "probing"
	stageConfirmed  = "confirmed"
	stageRolledBack = "rolledback"
)

// maxProbeRestarts is how many times the service may restart while a new
// binary is still unconfirmed before we treat it as crash-looping and roll
// back. maxProbeWindow bounds how long we wait for a healthy confirmation.
const (
	maxProbeRestarts = 3
	maxProbeWindow   = 15 * time.Minute
)

type updateState struct {
	Stage         string    `json:"stage"`
	From          string    `json:"from"`
	To            string    `json:"to"`
	OldExe        string    `json:"old_exe"`
	StagedAt      time.Time `json:"staged_at"`
	ProbeStarted  time.Time `json:"probe_started_at,omitempty"`
	ProbeRestarts int       `json:"probe_restarts,omitempty"`
	FailReason    string    `json:"fail_reason,omitempty"`
}

func statePath(dataDir string) string { return filepath.Join(dataDir, "update.json") }

func loadState(dataDir string) (*updateState, error) {
	raw, err := os.ReadFile(statePath(dataDir))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var s updateState
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func saveState(dataDir string, s *updateState) error {
	raw, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	tmp := statePath(dataDir) + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, statePath(dataDir))
}

func clearState(dataDir string) {
	_ = os.Remove(statePath(dataDir))
}

// resolveAction is what ResolvePending must do for a given state. The
// decision is split out as a pure function so the rollback logic — the part
// most important to get right — is unit-testable without a Windows box.
type resolveAction int

const (
	actionNone             resolveAction = iota // no update in flight / already probing
	actionRollback                              // restore the previous binary, then exit
	actionReportRolledBack                      // we're the restored binary: report + clean up
	actionCleanupConfirmed                      // confirmed earlier: delete old binary, clear state
)

// decideResolve inspects st at startup and returns the action plus the state
// to persist (nil = clear it). currentVersion is what this running binary
// reports; now is the wall clock (injected for tests).
func decideResolve(st *updateState, currentVersion string, now time.Time) (resolveAction, *updateState) {
	if st == nil {
		return actionNone, nil
	}
	switch st.Stage {
	case stageSwapped, stageProbing:
		if currentVersion != st.To {
			// A swap was in flight but we didn't boot the new version.
			st.FailReason = "post-swap version mismatch"
			return actionRollback, st
		}
		if st.Stage == stageSwapped {
			st.Stage = stageProbing
			st.ProbeStarted = now
		}
		st.ProbeRestarts++
		stalled := !st.ProbeStarted.IsZero() && now.Sub(st.ProbeStarted) > maxProbeWindow
		if st.ProbeRestarts > maxProbeRestarts || stalled {
			if stalled {
				st.FailReason = "new binary never confirmed healthy within the probe window"
			} else {
				st.FailReason = "new binary crash-looped before confirming healthy"
			}
			return actionRollback, st
		}
		return actionNone, st

	case stageRolledBack:
		return actionReportRolledBack, st

	case stageConfirmed:
		return actionCleanupConfirmed, st
	}
	return actionNone, st
}
