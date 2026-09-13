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

func TestCheckAppDailyLimit_WarnsThenBlocksInStages(t *testing.T) {
	cache := newTestCache(t)
	value, _ := json.Marshal(appDailyLimitValue{App: "roblox.exe", Minutes: 60})
	cache.Replace([]Rule{{ID: "r1", RuleType: "app_daily_limit_minutes", Value: value}})

	reporter := newTestReporter(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	})

	var notifications []string
	var blockCount int
	enforcer := NewEnforcer(cache, reporter,
		func(reason, message string) {
			blockCount++
			if reason != "app_daily_limit" || message != MessageAppLimitReached {
				t.Errorf("unexpected block: %q %q", reason, message)
			}
		},
		func(message string) { notifications = append(notifications, message) },
	)

	ctx := context.Background()

	enforcer.CheckAppDailyLimit(ctx, "roblox.exe", 40) // 20 min remaining
	if len(notifications) != 0 {
		t.Fatalf("expected no notifications yet, got %v", notifications)
	}

	enforcer.CheckAppDailyLimit(ctx, "roblox.exe", 50) // 10 min remaining
	if len(notifications) != 1 || notifications[0] != MessageAppWarn15Min {
		t.Fatalf("expected app 15min warning, got %v", notifications)
	}

	enforcer.CheckAppDailyLimit(ctx, "roblox.exe", 57) // 3 min remaining
	if len(notifications) != 2 || notifications[1] != MessageAppWarn5Min {
		t.Fatalf("expected app 5min warning appended, got %v", notifications)
	}

	if blockCount != 0 {
		t.Fatal("should not be blocked before the app limit is reached")
	}
	enforcer.CheckAppDailyLimit(ctx, "roblox.exe", 61) // limit exceeded
	if blockCount != 1 {
		t.Fatalf("expected exactly 1 block call at crossing, got %d", blockCount)
	}

	// A different app is unaffected.
	enforcer.CheckForegroundApp(ctx, "notepad.exe")
	if _, _, ok := enforcer.ActiveBlock(); ok {
		t.Fatal("a different app must not be blocked by roblox's limit")
	}
}

func TestCheckAppDailyLimit_ReopeningBlockedAppReblocksAndReports(t *testing.T) {
	cache := newTestCache(t)
	value, _ := json.Marshal(appDailyLimitValue{App: "roblox.exe", Minutes: 60})
	cache.Replace([]Rule{{ID: "r1", RuleType: "app_daily_limit_minutes", Value: value}})

	var reportedTypes []string
	reporter := newTestReporter(t, func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			AlertType string `json:"alert_type"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		reportedTypes = append(reportedTypes, body.AlertType)
		w.WriteHeader(http.StatusCreated)
	})

	var blockCount int
	enforcer := NewEnforcer(cache, reporter, func(reason, message string) { blockCount++ }, nil)
	ctx := context.Background()

	// Cross the limit while roblox is foregrounded (mirrors main.go calling
	// CheckAppDailyLimit then CheckForegroundApp for the same app each tick).
	enforcer.CheckAppDailyLimit(ctx, "roblox.exe", 61)
	enforcer.CheckForegroundApp(ctx, "roblox.exe")
	if blockCount != 1 {
		t.Fatalf("expected exactly 1 block at crossing (no double-fire), got %d", blockCount)
	}

	// Child switches away, then reopens roblox later the same day — still
	// over budget, so it must block (and report) again.
	enforcer.CheckForegroundApp(ctx, "notepad.exe")
	enforcer.CheckAppDailyLimit(ctx, "roblox.exe", 65)
	enforcer.CheckForegroundApp(ctx, "roblox.exe")
	if blockCount != 2 {
		t.Fatalf("expected a second block on reopening, got %d", blockCount)
	}
	if len(reportedTypes) != 2 {
		t.Fatalf("expected 2 alert reports, got %v", reportedTypes)
	}
}

func TestCheckAppDailyLimit_RuleRemovedUnblocks(t *testing.T) {
	cache := newTestCache(t)
	value, _ := json.Marshal(appDailyLimitValue{App: "roblox.exe", Minutes: 60})
	cache.Replace([]Rule{{ID: "r1", RuleType: "app_daily_limit_minutes", Value: value}})

	reporter := newTestReporter(t, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusCreated) })
	enforcer := NewEnforcer(cache, reporter, func(reason, message string) {}, nil)
	ctx := context.Background()

	enforcer.CheckAppDailyLimit(ctx, "roblox.exe", 61)
	enforcer.CheckForegroundApp(ctx, "roblox.exe")
	if _, _, ok := enforcer.ActiveBlock(); !ok {
		t.Fatal("expected blocked after crossing the limit")
	}

	// Parent removes the rule.
	cache.Replace(nil)
	enforcer.CheckForegroundApp(ctx, "notepad.exe") // clears the per-session alertedApp
	enforcer.CheckAppDailyLimit(ctx, "roblox.exe", 61)
	enforcer.CheckForegroundApp(ctx, "roblox.exe")
	if _, _, ok := enforcer.ActiveBlock(); ok {
		t.Fatal("expected unblocked once the app_daily_limit_minutes rule is removed")
	}
}

func TestActiveBlock(t *testing.T) {
	ctx := context.Background()
	noop := func(string, string) {}
	reporter := newTestReporter(t, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusCreated) })

	t.Run("clear when nothing applies", func(t *testing.T) {
		cache := newTestCache(t)
		cache.Replace(nil)
		e := NewEnforcer(cache, reporter, noop, nil)
		e.CheckForegroundApp(ctx, "chrome.exe")
		e.CheckDailyLimit(ctx, 10)
		e.CheckBlockedWindow(ctx)
		if _, _, ok := e.ActiveBlock(); ok {
			t.Fatal("ActiveBlock should be false with no rules in effect")
		}
	})

	t.Run("blocked app while foregrounded", func(t *testing.T) {
		cache := newTestCache(t)
		v, _ := json.Marshal(blockedAppValue{App: "steam.exe"})
		cache.Replace([]Rule{{ID: "a1", RuleType: "blocked_app", Value: v}})
		e := NewEnforcer(cache, reporter, noop, nil)

		e.CheckForegroundApp(ctx, "steam.exe")
		reason, msg, ok := e.ActiveBlock()
		if !ok || reason != "blocked_app" || msg != MessageAppUnavailable {
			t.Fatalf("got %q %q %v", reason, msg, ok)
		}
		// Foreground moves away -> the block clears.
		e.CheckForegroundApp(ctx, "notepad.exe")
		if _, _, ok := e.ActiveBlock(); ok {
			t.Fatal("ActiveBlock should clear once the blocked app is no longer foreground")
		}
	})

	t.Run("daily limit reached stays blocked", func(t *testing.T) {
		cache := newTestCache(t)
		v, _ := json.Marshal(dailyLimitValue{Minutes: 60})
		cache.Replace([]Rule{{ID: "r1", RuleType: "daily_limit_minutes", Value: v}})
		e := NewEnforcer(cache, reporter, noop, nil)

		e.CheckDailyLimit(ctx, 30)
		if _, _, ok := e.ActiveBlock(); ok {
			t.Fatal("not blocked below the limit")
		}
		e.CheckDailyLimit(ctx, 65)
		reason, msg, ok := e.ActiveBlock()
		if !ok || reason != "daily_limit" || msg != MessageLimitReached {
			t.Fatalf("got %q %q %v", reason, msg, ok)
		}
		// A later poll with the count still over keeps it blocked.
		e.CheckDailyLimit(ctx, 70)
		if _, _, ok := e.ActiveBlock(); !ok {
			t.Fatal("should remain blocked for the rest of the day")
		}
	})

	t.Run("quiet hours outrank the daily limit", func(t *testing.T) {
		cache := newTestCache(t)
		limit, _ := json.Marshal(dailyLimitValue{Minutes: 60})
		win, _ := json.Marshal(blockedWindowValue{Start: "00:01", End: "00:00"}) // ~always active
		cache.Replace([]Rule{
			{ID: "r1", RuleType: "daily_limit_minutes", Value: limit},
			{ID: "w1", RuleType: "blocked_window", Value: win},
		})
		e := NewEnforcer(cache, reporter, noop, nil)

		e.CheckDailyLimit(ctx, 65)
		e.CheckBlockedWindow(ctx)
		reason, msg, ok := e.ActiveBlock()
		if !ok || reason != "blocked_window" || msg != MessageQuietHours {
			t.Fatalf("expected quiet-hours to win, got %q %q %v", reason, msg, ok)
		}
	})
}
