package rules

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func newTestCache(t *testing.T) *Cache {
	t.Helper()
	cache, err := OpenCache(filepath.Join(t.TempDir(), "rules.db"))
	if err != nil {
		t.Fatalf("opening cache: %v", err)
	}
	t.Cleanup(func() { cache.Close() })
	return cache
}

func newTestReporter(t *testing.T, handler http.HandlerFunc) *AlertReporter {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return NewAlertReporter(server.URL, "device-1", "secret")
}

func TestCheckForegroundApp_BlocksAndReportsOnce(t *testing.T) {
	cache := newTestCache(t)
	value, _ := json.Marshal(blockedAppValue{App: "steam.exe"})
	if err := cache.Replace([]Rule{{ID: "r1", RuleType: "blocked_app", Value: value}}); err != nil {
		t.Fatalf("seeding cache: %v", err)
	}

	var reportCount int
	reporter := newTestReporter(t, func(w http.ResponseWriter, r *http.Request) {
		reportCount++
		w.WriteHeader(http.StatusCreated)
	})

	var blockCount int
	enforcer := NewEnforcer(cache, reporter, func(reason, message string) {
		blockCount++
		if message != MessageAppUnavailable {
			t.Errorf("unexpected block message: %q", message)
		}
	}, nil)

	ctx := context.Background()
	// Same blocked app polled 3 times in a row (simulating tracker ticks
	// while it stays in the foreground) — should only block/report once.
	enforcer.CheckForegroundApp(ctx, "steam.exe")
	enforcer.CheckForegroundApp(ctx, "steam.exe")
	enforcer.CheckForegroundApp(ctx, "steam.exe")

	if blockCount != 1 {
		t.Errorf("expected 1 block call, got %d", blockCount)
	}
	if reportCount != 1 {
		t.Errorf("expected 1 alert report, got %d", reportCount)
	}

	// Switching to a non-blocked app and back re-triggers (new "session").
	enforcer.CheckForegroundApp(ctx, "notepad.exe")
	enforcer.CheckForegroundApp(ctx, "steam.exe")
	if blockCount != 2 {
		t.Errorf("expected 2 block calls after reopening, got %d", blockCount)
	}
}

func TestCheckForegroundApp_AllowsNonBlockedApp(t *testing.T) {
	cache := newTestCache(t)
	value, _ := json.Marshal(blockedAppValue{App: "steam.exe"})
	cache.Replace([]Rule{{ID: "r1", RuleType: "blocked_app", Value: value}})

	reporter := newTestReporter(t, func(w http.ResponseWriter, r *http.Request) {
		t.Error("should not report an alert for a non-blocked app")
	})

	enforcer := NewEnforcer(cache, reporter, func(reason, message string) {
		t.Error("should not block a non-blocked app")
	}, nil)

	enforcer.CheckForegroundApp(context.Background(), "notepad.exe")
}

func TestDailyLimitMinutes_WeekendOverride(t *testing.T) {
	cache := newTestCache(t)
	weekend := 30.0
	value, _ := json.Marshal(dailyLimitValue{Minutes: 120, WeekendMinutes: &weekend})
	cache.Replace([]Rule{{ID: "r1", RuleType: "daily_limit_minutes", Value: value}})

	enforcer := NewEnforcer(cache, nil, nil, nil)
	got, ok := enforcer.DailyLimitMinutes()
	if !ok {
		t.Fatal("expected a limit")
	}

	isWeekend := func() bool {
		wd := time.Now().Weekday()
		return wd == time.Saturday || wd == time.Sunday
	}()
	want := 120.0
	if isWeekend {
		want = 30.0
	}
	if got != want {
		t.Fatalf("weekend=%v: got %v, want %v", isWeekend, got, want)
	}
}

func TestDailyLimitMinutes_NoWeekendKeyFallsBackToMinutes(t *testing.T) {
	cache := newTestCache(t)
	value, _ := json.Marshal(dailyLimitValue{Minutes: 90})
	cache.Replace([]Rule{{ID: "r1", RuleType: "daily_limit_minutes", Value: value}})

	enforcer := NewEnforcer(cache, nil, nil, nil)
	got, ok := enforcer.DailyLimitMinutes()
	if !ok || got != 90 {
		t.Fatalf("got %v, %v; want 90, true", got, ok)
	}
}

func TestWithinWindow(t *testing.T) {
	cases := []struct {
		now, start, end int
		want            bool
	}{
		{now: 23 * 60, start: 22 * 60, end: 7 * 60, want: true},   // wrap, late night
		{now: 3 * 60, start: 22 * 60, end: 7 * 60, want: true},    // wrap, early morning
		{now: 12 * 60, start: 22 * 60, end: 7 * 60, want: false},  // wrap, midday — allowed
		{now: 13 * 60, start: 12 * 60, end: 14 * 60, want: true},  // same-day window
		{now: 15 * 60, start: 12 * 60, end: 14 * 60, want: false}, // same-day, after
		{now: 8 * 60, start: 7 * 60, end: 7 * 60, want: false},    // zero-width
	}
	for _, c := range cases {
		if got := withinWindow(c.now, c.start, c.end); got != c.want {
			t.Errorf("withinWindow(%d,%d,%d)=%v want %v", c.now, c.start, c.end, got, c.want)
		}
	}
}

func TestParseHHMM(t *testing.T) {
	if m, ok := parseHHMM("22:30"); !ok || m != 22*60+30 {
		t.Errorf("22:30 -> %d,%v", m, ok)
	}
	for _, bad := range []string{"24:00", "9:99", "abc", "", "22"} {
		if _, ok := parseHHMM(bad); ok {
			t.Errorf("%q parsed but should not", bad)
		}
	}
}

func TestCheckBlockedWindow_BlocksOncePerEntry(t *testing.T) {
	cache := newTestCache(t)
	// A window covering every minute of the day: [00:00, 00:00) is zero-width,
	// so use 00:01 wrapping to 00:00 which is active virtually always.
	value, _ := json.Marshal(blockedWindowValue{Start: "00:01", End: "00:00"})
	cache.Replace([]Rule{{ID: "w1", RuleType: "blocked_window", Value: value}})

	reporter := newTestReporter(t, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusCreated) })
	var blocks int
	enforcer := NewEnforcer(cache, reporter, func(reason, message string) {
		blocks++
		if reason != "blocked_window" || message != MessageQuietHours {
			t.Errorf("unexpected block %q %q", reason, message)
		}
	}, nil)

	ctx := context.Background()
	enforcer.CheckBlockedWindow(ctx)
	enforcer.CheckBlockedWindow(ctx)
	enforcer.CheckBlockedWindow(ctx)
	if blocks != 1 {
		t.Fatalf("expected 1 block on entry, got %d", blocks)
	}
}

func TestCheckBlockedWindow_NoRuleNoBlock(t *testing.T) {
	cache := newTestCache(t)
	cache.Replace(nil)
	enforcer := NewEnforcer(cache, nil, func(reason, message string) {
		t.Error("should not block without a blocked_window rule")
	}, nil)
	enforcer.CheckBlockedWindow(context.Background())
}

func TestCheckDailyLimit_WarnsThenBlocksInStages(t *testing.T) {
	cache := newTestCache(t)
	value, _ := json.Marshal(dailyLimitValue{Minutes: 120})
	cache.Replace([]Rule{{ID: "r1", RuleType: "daily_limit_minutes", Value: value}})

	reporter := newTestReporter(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	})

	var notifications []string
	var blocked bool
	enforcer := NewEnforcer(cache, reporter,
		func(reason, message string) {
			blocked = true
			if message != MessageLimitReached {
				t.Errorf("unexpected block message: %q", message)
			}
		},
		func(message string) { notifications = append(notifications, message) },
	)

	ctx := context.Background()

	enforcer.CheckDailyLimit(ctx, 100) // 20 min remaining — no warning yet
	if len(notifications) != 0 {
		t.Fatalf("expected no notifications at 20min remaining, got %v", notifications)
	}

	enforcer.CheckDailyLimit(ctx, 110) // 10 min remaining — 15min-stage warning
	if len(notifications) != 1 || notifications[0] != MessageWarn15Min {
		t.Fatalf("expected 15min warning, got %v", notifications)
	}

	enforcer.CheckDailyLimit(ctx, 110) // still 10 min remaining — must not repeat
	if len(notifications) != 1 {
		t.Fatalf("15min warning should not repeat, got %v", notifications)
	}

	enforcer.CheckDailyLimit(ctx, 117) // 3 min remaining — 5min-stage warning
	if len(notifications) != 2 || notifications[1] != MessageWarn5Min {
		t.Fatalf("expected 5min warning appended, got %v", notifications)
	}

	if blocked {
		t.Fatal("should not be blocked before limit is reached")
	}
	enforcer.CheckDailyLimit(ctx, 121) // limit exceeded
	if !blocked {
		t.Fatal("expected block once limit is reached")
	}
}
