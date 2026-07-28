package service

import (
	"testing"
	"time"
)

func TestDefaultRecoveryConfig_RestartsOnEveryFailure(t *testing.T) {
	cfg := DefaultRecoveryConfig()

	if len(cfg.Actions) == 0 {
		t.Fatal("expected at least one recovery action")
	}
	for i, a := range cfg.Actions {
		if a.Type != ActionRestart {
			t.Errorf("action %d: expected ActionRestart, got %v", i, a.Type)
		}
		if a.Delay <= 0 {
			t.Errorf("action %d: expected a positive delay, got %v", i, a.Delay)
		}
	}
}

func TestDefaultRecoveryConfig_FirstFailureRestartsQuickly(t *testing.T) {
	cfg := DefaultRecoveryConfig()
	// The whole point of this config is that an update-triggered exit
	// recovers fast — a multi-minute gap here would leave the agent
	// invisibly down for longer than acceptable.
	if cfg.Actions[0].Delay > 30*time.Second {
		t.Errorf("first restart delay too slow for an update-triggered exit: %v", cfg.Actions[0].Delay)
	}
}

func TestResetPeriodSeconds(t *testing.T) {
	cfg := RecoveryConfig{ResetPeriod: 24 * time.Hour}
	if got, want := cfg.ResetPeriodSeconds(), uint32(86400); got != want {
		t.Errorf("ResetPeriodSeconds() = %d, want %d", got, want)
	}

	cfg = RecoveryConfig{ResetPeriod: 90 * time.Second}
	if got, want := cfg.ResetPeriodSeconds(), uint32(90); got != want {
		t.Errorf("ResetPeriodSeconds() = %d, want %d", got, want)
	}
}
