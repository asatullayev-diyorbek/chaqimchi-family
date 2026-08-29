package updater

import (
	"path/filepath"
	"testing"
	"time"
)

func TestStateRoundTrip(t *testing.T) {
	dir := t.TempDir()
	if got, err := loadState(dir); err != nil || got != nil {
		t.Fatalf("empty dir: want (nil,nil), got (%v,%v)", got, err)
	}
	in := &updateState{Stage: stageSwapped, From: "0.4.0", To: "0.5.0", OldExe: filepath.Join(dir, "agent.old.exe"), StagedAt: time.Now().Truncate(time.Second)}
	if err := saveState(dir, in); err != nil {
		t.Fatal(err)
	}
	out, err := loadState(dir)
	if err != nil || out == nil || out.To != "0.5.0" || out.Stage != stageSwapped {
		t.Fatalf("round trip: %+v err=%v", out, err)
	}
	clearState(dir)
	if got, _ := loadState(dir); got != nil {
		t.Fatalf("after clear: want nil, got %+v", got)
	}
}

func TestDecideResolve(t *testing.T) {
	now := time.Date(2026, 8, 30, 12, 0, 0, 0, time.UTC)

	t.Run("no state", func(t *testing.T) {
		if a, _ := decideResolve(nil, "0.5.0", now); a != actionNone {
			t.Fatalf("want actionNone, got %v", a)
		}
	})

	t.Run("fresh swap starts probing", func(t *testing.T) {
		st := &updateState{Stage: stageSwapped, From: "0.4.0", To: "0.5.0"}
		a, next := decideResolve(st, "0.5.0", now)
		if a != actionNone || next.Stage != stageProbing || next.ProbeRestarts != 1 || next.ProbeStarted != now {
			t.Fatalf("unexpected: action=%v state=%+v", a, next)
		}
	})

	t.Run("wrong version after swap rolls back", func(t *testing.T) {
		st := &updateState{Stage: stageSwapped, From: "0.4.0", To: "0.5.0"}
		if a, _ := decideResolve(st, "0.4.0", now); a != actionRollback {
			t.Fatalf("want actionRollback, got %v", a)
		}
	})

	t.Run("crash loop rolls back", func(t *testing.T) {
		st := &updateState{Stage: stageProbing, To: "0.5.0", ProbeStarted: now.Add(-time.Minute), ProbeRestarts: maxProbeRestarts}
		a, next := decideResolve(st, "0.5.0", now)
		if a != actionRollback || next.FailReason == "" {
			t.Fatalf("want rollback with reason, got action=%v state=%+v", a, next)
		}
	})

	t.Run("stalled probe rolls back", func(t *testing.T) {
		st := &updateState{Stage: stageProbing, To: "0.5.0", ProbeStarted: now.Add(-maxProbeWindow - time.Minute), ProbeRestarts: 1}
		if a, _ := decideResolve(st, "0.5.0", now); a != actionRollback {
			t.Fatalf("want actionRollback for stalled probe, got %v", a)
		}
	})

	t.Run("healthy probe within limits continues", func(t *testing.T) {
		st := &updateState{Stage: stageProbing, To: "0.5.0", ProbeStarted: now.Add(-time.Minute), ProbeRestarts: 1}
		a, next := decideResolve(st, "0.5.0", now)
		if a != actionNone || next.ProbeRestarts != 2 {
			t.Fatalf("want actionNone w/ incremented restarts, got action=%v state=%+v", a, next)
		}
	})

	t.Run("rolledback reports and cleans", func(t *testing.T) {
		st := &updateState{Stage: stageRolledBack, From: "0.4.0", To: "0.5.0", FailReason: "boom"}
		if a, _ := decideResolve(st, "0.4.0", now); a != actionReportRolledBack {
			t.Fatalf("want actionReportRolledBack, got %v", a)
		}
	})

	t.Run("confirmed cleans up", func(t *testing.T) {
		st := &updateState{Stage: stageConfirmed, To: "0.5.0"}
		if a, _ := decideResolve(st, "0.5.0", now); a != actionCleanupConfirmed {
			t.Fatalf("want actionCleanupConfirmed, got %v", a)
		}
	})
}
