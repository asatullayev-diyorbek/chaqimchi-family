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

type blockedWindowValue struct {
	Start string `json:"start"` // "HH:MM", child's local time
	End   string `json:"end"`   // "HH:MM"; End <= Start means the window wraps past midnight
}

type Enforcer struct {
	Cache    *Cache
	Reporter *AlertReporter
	Block    BlockFunc
	Notify   NotifyFunc

	mu             sync.Mutex
	alertedApp     string // blocked app we've already alerted on, cleared when foreground moves away
	limitStage     int    // 0=none, 1=15min warned, 2=5min warned, 3=limit reached handled
	limitStageDate string // date the stage counters apply to; resets them at midnight
	inQuietHours   bool   // currently inside a blocked_window; blocks once per entry, not every poll
}

func NewEnforcer(cache *Cache, reporter *AlertReporter, block BlockFunc, notify NotifyFunc) *Enforcer {
	return &Enforcer{Cache: cache, Reporter: reporter, Block: block, Notify: notify}
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
// in the foreground (see internal/tracker/app_usage.go). If that app is on
// the blocked list, it blocks and reports exactly once per "session" (until
// the foreground app changes away from it), not on every poll tick.
func (e *Enforcer) CheckForegroundApp(ctx context.Context, app string) {
	if app == "" {
		return
	}
	blocked := false
	for _, blockedApp := range e.blockedApps() {
		if strings.EqualFold(blockedApp, app) {
			blocked = true
			break
		}
	}

	e.mu.Lock()
	alreadyAlerted := e.alertedApp == app
	if blocked {
		e.alertedApp = app
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
		e.Block("blocked_app", MessageAppUnavailable)
	}
	if e.Reporter != nil {
		if err := e.Reporter.Report(ctx, "blocked_app_opened", map[string]any{"app": app}); err != nil {
			log.Printf("rules enforcer: reporting blocked_app_opened: %v", err)
		}
	}
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
