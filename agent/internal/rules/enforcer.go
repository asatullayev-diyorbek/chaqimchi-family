package rules

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// BlockFunc shows the full-screen block overlay (agent/internal/ui on
// Windows). reason is "blocked_app" or "daily_limit" — purely for the
// caller's own logging/UI branching, never shown verbatim to the child.
// message is the exact, already-gentle text to display.
type BlockFunc func(reason, message string)

// NotifyFunc shows a tray/toast warning, e.g. an upcoming limit.
type NotifyFunc func(message string)

// Language note: every string here is checked against
// docs/chaqimchiai-family-bola-ilova-dizayn-talablari.md 4.3-4.4 va 6-bo'lim
// (the child-app doc's explicit banned-word list: "taqiqlangan", "buzildi",
// "ruxsatsiz", "jazo", "kuzatilyapsan" — none of these appear below).
// MessageAppUnavailable and MessageLimitReached are quoted close to
// verbatim from 4.4-bo'lim's own examples, including the required second
// line pointing the child to their parent rather than leaving them stuck.
// MessageBlockedAppToast is the separate notification 4.3-bo'lim requires
// alongside (not instead of) the block screen itself.
const (
	MessageAppUnavailable  = "Bu ilova hozircha mavjud emas\n\nSavoling bo'lsa, ota-onangga murojaat qil"
	MessageLimitReached    = "Bugungi ekran vaqting tugadi. Ertaga davom etasan!\n\nSavoling bo'lsa, ota-onangga murojaat qil"
	MessageBlockedAppToast = "Bu ilova/sayt ota-onang tomonidan cheklangan"
	MessageWarn15Min       = "15 daqiqadan keyin bugungi ekran vaqting tugaydi"
	MessageWarn5Min        = "5 daqiqadan keyin bugungi ekran vaqting tugaydi"
	MessageQuietHours      = "Hozir dam olish vaqti. Ertaga davom etasan!\n\nSavoling bo'lsa, ota-onangga murojaat qil"

	// app_daily_limit_minutes — a per-app daily budget, distinct from
	// daily_limit_minutes (the whole-device budget). Reuses the same
	// warn-then-block staging as the device-wide limit, scoped to one app.
	MessageAppLimitReached = "Bu ilova uchun bugungi vaqting tugadi. Ertaga davom etasan!\n\nSavoling bo'lsa, ota-onangga murojaat qil"
	MessageAppWarn15Min    = "15 daqiqadan keyin bu ilova uchun bugungi vaqting tugaydi"
	MessageAppWarn5Min     = "5 daqiqadan keyin bu ilova uchun bugungi vaqting tugaydi"
)

type blockedAppValue struct {
	App string `json:"app"`
}

type dailyLimitValue struct {
	Minutes float64 `json:"minutes"`
	// WeekendMinutes, when set, replaces Minutes on Saturday and Sunday
	// (child-app design §4.5: "Dushanba–Juma / Shanba–Yakshanba uchun
	// alohida qiymat"). Pointer so "0 minutes on weekends" is distinct from
	// "not configured".
	WeekendMinutes *float64 `json:"weekend_minutes,omitempty"`
}

type appDailyLimitValue struct {
	App     string  `json:"app"`
	Minutes float64 `json:"minutes"`
}

type blockedWindowValue struct {
	Start string `json:"start"` // "HH:MM", child's local time
	End   string `json:"end"`   // "HH:MM"; End <= Start means the window wraps past midnight
}

type Enforcer struct {
	Cache    *Cache
	Reporter *AlertReporter
	Block    BlockFunc
	Notify   NotifyFunc

	mu                sync.Mutex
	alertedApp        string // blocked app we've already alerted on, cleared when foreground moves away
	alertedAppReason  string // "blocked_app" or "app_daily_limit" — which condition alertedApp is for
	alertedAppMessage string
	limitStage        int    // 0=none, 1=15min warned, 2=5min warned, 3=limit reached handled
	limitStageDate    string // date the stage counters apply to; resets them at midnight
	inQuietHours      bool   // currently inside a blocked_window; blocks once per entry, not every poll

	// Per-app daily limits (app_daily_limit_minutes) — keyed by lowercased
	// exe name. appLimitStage mirrors limitStage but per app (0-2; reaching
	// the limit moves the app into appLimitReached instead of a stage 3).
	// appLimitDate is shared across every app, same single-field reset
	// pattern as limitStageDate.
	appLimitReached map[string]bool
	appLimitStage   map[string]int
	appLimitDate    string
}

func NewEnforcer(cache *Cache, reporter *AlertReporter, block BlockFunc, notify NotifyFunc) *Enforcer {
	return &Enforcer{
		Cache:           cache,
		Reporter:        reporter,
		Block:           block,
		Notify:          notify,
		appLimitReached: make(map[string]bool),
		appLimitStage:   make(map[string]int),
	}
}

func (e *Enforcer) blockedApps() []string {
	rules, err := e.Cache.All()
	if err != nil {
		log.Printf("rules enforcer: reading cache: %v", err)
		return nil
	}
	var apps []string
	for _, r := range rules {
		if r.RuleType != "blocked_app" {
			continue
		}
		var v blockedAppValue
		if err := json.Unmarshal(r.Value, &v); err != nil || v.App == "" {
			continue
		}
		apps = append(apps, v.App)
	}
	return apps
}

// DailyLimitMinutes exposes the current daily screen-time limit (if any) so
// the status UI can show remaining time alongside enforcement.
func (e *Enforcer) DailyLimitMinutes() (float64, bool) { return e.dailyLimitMinutes() }

// ActiveBlock reports whether the child should currently be seeing a block
// screen, and with what text. Unlike the BlockFunc callback — which fires
// once on the edge (entering a quiet-hours window, crossing the daily limit,
// focusing a blocked app) — this is level-triggered: it stays true for as
// long as the condition holds, so a user-session helper can poll it and
// raise/dismiss the overlay accordingly. It derives purely from state the
// Check* methods already maintain, so it is only accurate once those have
// run at least once for the current poll tick.
//
// Precedence when several apply: quiet hours, then daily limit, then blocked
// app — the broadest restriction wins the screen.
func (e *Enforcer) ActiveBlock() (reason, message string, ok bool) {
	today := time.Now().UTC().Format("2006-01-02")

	e.mu.Lock()
	defer e.mu.Unlock()

	switch {
	case e.inQuietHours:
		return "blocked_window", MessageQuietHours, true
	case e.limitStage >= 3 && e.limitStageDate == today:
		return "daily_limit", MessageLimitReached, true
	case e.alertedApp != "":
		return e.alertedAppReason, e.alertedAppMessage, true
	default:
		return "", "", false
	}
}

func (e *Enforcer) dailyLimitMinutes() (float64, bool) {
	rules, err := e.Cache.All()
	if err != nil {
		log.Printf("rules enforcer: reading cache: %v", err)
		return 0, false
	}
	for _, r := range rules {
		if r.RuleType != "daily_limit_minutes" {
			continue
		}
		var v dailyLimitValue
		if err := json.Unmarshal(r.Value, &v); err != nil {
			continue
		}
		if v.WeekendMinutes != nil {
			// Local weekday: the limit period is the child's calendar day,
			// and near midnight a UTC weekday can be a day off.
			if wd := time.Now().Weekday(); wd == time.Saturday || wd == time.Sunday {
				return *v.WeekendMinutes, true
			}
		}
		return v.Minutes, true
	}
	return 0, false
}

// CheckForegroundApp is called every time the tracker observes which app is
// in the foreground (see internal/tracker/app_usage.go). If that app is
// either on the static blocked list or has already used up its
// app_daily_limit_minutes budget for today, it blocks and reports exactly
// once per "session" (until the foreground app changes away from it), not
// on every poll tick. Call CheckAppDailyLimit for this same app first each
// tick — the moment a per-app budget is crossed, that call flags the app as
// blocked, which this method's next read of appLimitReached must see.
func (e *Enforcer) CheckForegroundApp(ctx context.Context, app string) {
	if app == "" {
		return
	}
	reason, message, blocked := "", "", false
	for _, blockedApp := range e.blockedApps() {
		if strings.EqualFold(blockedApp, app) {
			reason, message, blocked = "blocked_app", MessageAppUnavailable, true
			break
		}
	}
	if !blocked && e.isAppLimitReached(app) {
		reason, message, blocked = "app_daily_limit", MessageAppLimitReached, true
	}

	e.mu.Lock()
	alreadyAlerted := e.alertedApp == app
	if blocked {
		e.alertedApp = app
		e.alertedAppReason = reason
		e.alertedAppMessage = message
	} else {
		e.alertedApp = ""
	}
	e.mu.Unlock()

	if !blocked || alreadyAlerted {
		return
	}

	// Doc requires both: an immediate calm toast AND the block screen,
	// not one or the other.
	if e.Notify != nil {
		e.Notify(MessageBlockedAppToast)
	}
	if e.Block != nil {
		e.Block(reason, message)
	}
	if e.Reporter != nil {
		payload := map[string]any{"app": app}
		if reason == "app_daily_limit" {
			payload["reason"] = reason
		}
		if err := e.Reporter.Report(ctx, "blocked_app_opened", payload); err != nil {
			log.Printf("rules enforcer: reporting blocked_app_opened: %v", err)
		}
	}
}

func (e *Enforcer) isAppLimitReached(app string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.appLimitReached[strings.ToLower(app)]
}

// appDailyLimitMinutes returns the app_daily_limit_minutes budget configured
// for app (case-insensitive match against the rule's own "app" value), if any.
func (e *Enforcer) appDailyLimitMinutes(app string) (float64, bool) {
	rules, err := e.Cache.All()
	if err != nil {
		log.Printf("rules enforcer: reading cache: %v", err)
		return 0, false
	}
	for _, r := range rules {
		if r.RuleType != "app_daily_limit_minutes" {
			continue
		}
		var v appDailyLimitValue
		if err := json.Unmarshal(r.Value, &v); err != nil || v.App == "" {
			continue
		}
		if strings.EqualFold(v.App, app) {
			return v.Minutes, true
		}
	}
	return 0, false
}

// CheckAppDailyLimit compares appMinutesToday (the caller's own running
// per-app total for the currently foregrounded app) against that app's
// app_daily_limit_minutes rule, if any — the same warn-then-block staging as
// CheckDailyLimit, scoped to one app instead of the whole device. Call this
// before CheckForegroundApp for the same app each tick, so a budget crossed
// mid-session blocks immediately rather than one tick later.
func (e *Enforcer) CheckAppDailyLimit(ctx context.Context, app string, appMinutesToday float64) {
	if app == "" {
		return
	}
	limit, ok := e.appDailyLimitMinutes(app)
	key := strings.ToLower(app)
	today := time.Now().UTC().Format("2006-01-02")

	e.mu.Lock()
	if e.appLimitDate != today {
		e.appLimitDate = today
		e.appLimitReached = make(map[string]bool)
		e.appLimitStage = make(map[string]int)
	}
	if !ok {
		// Rule removed (or never existed) — nothing to enforce, and any
		// stale reached-flag from an earlier rule for this app is cleared
		// so removing the rule un-blocks on the very next poll.
		delete(e.appLimitReached, key)
		delete(e.appLimitStage, key)
		e.mu.Unlock()
		return
	}
	stage := e.appLimitStage[key]
	e.mu.Unlock()

	remaining := limit - appMinutesToday

	switch {
	case remaining <= 0 && stage < 3:
		e.mu.Lock()
		e.appLimitStage[key] = 3
		e.appLimitReached[key] = true
		// Pre-mark alertedApp so CheckForegroundApp's session-entry check
		// (running right after this, same tick) doesn't fire a second,
		// redundant blocked_app_opened report for this exact crossing —
		// this call already reports it below via limit_reached.
		e.alertedApp = app
		e.alertedAppReason = "app_daily_limit"
		e.alertedAppMessage = MessageAppLimitReached
		e.mu.Unlock()
		if e.Notify != nil {
			e.Notify(MessageBlockedAppToast)
		}
		if e.Block != nil {
			e.Block("app_daily_limit", MessageAppLimitReached)
		}
		if e.Reporter != nil {
			if err := e.Reporter.Report(ctx, "limit_reached", map[string]any{"app": app, "minutes": limit}); err != nil {
				log.Printf("rules enforcer: reporting app limit_reached: %v", err)
			}
		}
	case remaining <= 5 && stage < 2:
		e.setAppStage(key, 2)
		if e.Notify != nil {
			e.Notify(MessageAppWarn5Min)
		}
	case remaining <= 15 && stage < 1:
		e.setAppStage(key, 1)
		if e.Notify != nil {
			e.Notify(MessageAppWarn15Min)
		}
	}
}

func (e *Enforcer) setAppStage(key string, stage int) {
	e.mu.Lock()
	e.appLimitStage[key] = stage
	e.mu.Unlock()
}

// CheckDailyLimit compares todayScreenMinutes (the caller's own running
// total — see sync-with-buffer logic in cmd/agent) against the
// daily_limit_minutes rule, if any, warning at 15 and 5 minutes remaining
// and blocking once the limit is reached. Each stage fires once per day.
func (e *Enforcer) CheckDailyLimit(ctx context.Context, todayScreenMinutes float64) {
	limit, ok := e.dailyLimitMinutes()

	today := time.Now().UTC().Format("2006-01-02")

	e.mu.Lock()
	if e.limitStageDate != today {
		e.limitStageDate = today
		e.limitStage = 0
	}
	if !ok {
		e.limitStage = 0
		e.mu.Unlock()
		return
	}
	stage := e.limitStage
	e.mu.Unlock()

	remaining := limit - todayScreenMinutes

	switch {
	case remaining <= 0 && stage < 3:
		e.setStage(3)
		if e.Block != nil {
			e.Block("daily_limit", MessageLimitReached)
		}
		if e.Reporter != nil {
			if err := e.Reporter.Report(ctx, "limit_reached", map[string]any{"minutes": limit}); err != nil {
				log.Printf("rules enforcer: reporting limit_reached: %v", err)
			}
		}
	case remaining <= 5 && stage < 2:
		e.setStage(2)
		if e.Notify != nil {
			e.Notify(MessageWarn5Min)
		}
	case remaining <= 15 && stage < 1:
		e.setStage(1)
		if e.Notify != nil {
			e.Notify(MessageWarn15Min)
		}
	}
}

// parseHHMM converts "HH:MM" to minutes past midnight; ok is false on any
// malformed value so a bad rule fails open rather than blocking all day.
func parseHHMM(s string) (int, bool) {
	var h, m int
	if n, err := fmt.Sscanf(strings.TrimSpace(s), "%d:%d", &h, &m); err != nil || n != 2 {
		return 0, false
	}
	if h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, false
	}
	return h*60 + m, true
}

// withinWindow reports whether nowMin (minutes past local midnight) falls in
// [start, end). An end at or before start is read as wrapping past midnight
// (e.g. 22:00–07:00).
func withinWindow(nowMin, start, end int) bool {
	if start == end {
		return false
	}
	if start < end {
		return nowMin >= start && nowMin < end
	}
	return nowMin >= start || nowMin < end
}

func (e *Enforcer) blockedWindowActive() bool {
	rules, err := e.Cache.All()
	if err != nil {
		log.Printf("rules enforcer: reading cache: %v", err)
		return false
	}
	now := time.Now()
	nowMin := now.Hour()*60 + now.Minute()
	for _, r := range rules {
		if r.RuleType != "blocked_window" {
			continue
		}
		var v blockedWindowValue
		if err := json.Unmarshal(r.Value, &v); err != nil {
			continue
		}
		start, ok1 := parseHHMM(v.Start)
		end, ok2 := parseHHMM(v.End)
		if !ok1 || !ok2 {
			continue
		}
		if withinWindow(nowMin, start, end) {
			return true
		}
	}
	return false
}

// CheckBlockedWindow blocks the screen while the child's local time is inside
// any blocked_window rule ("quiet hours"). It fires the block once per entry
// into a window, not on every poll, and reports a limit_reached alert so the
// parent sees why.
func (e *Enforcer) CheckBlockedWindow(ctx context.Context) {
	active := e.blockedWindowActive()

	e.mu.Lock()
	firstEntry := active && !e.inQuietHours
	e.inQuietHours = active
	e.mu.Unlock()

	if !firstEntry {
		return
	}
	if e.Block != nil {
		e.Block("blocked_window", MessageQuietHours)
	}
	if e.Reporter != nil {
		if err := e.Reporter.Report(ctx, "limit_reached", map[string]any{"reason": "quiet_hours"}); err != nil {
			log.Printf("rules enforcer: reporting quiet_hours: %v", err)
		}
	}
}

func (e *Enforcer) setStage(stage int) {
	e.mu.Lock()
	e.limitStage = stage
	e.mu.Unlock()
}
