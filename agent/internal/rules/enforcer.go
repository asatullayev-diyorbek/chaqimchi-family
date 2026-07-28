package rules

import (
	"context"
	"encoding/json"
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

// Language note: every string here follows the child-app doc's tone rule —
// no blame, no "taqiqlangan"/"buzildi". These are the only two enforcement
// messages in this bosqich; keep any future ones held to the same bar.
const (
	MessageAppUnavailable = "Bu ilova hozircha mavjud emas"
	MessageLimitReached   = "Bugungi ekran vaqting tugadi. Ertaga davom etamiz!"
	MessageWarn15Min      = "15 daqiqadan keyin bugungi ekran vaqting tugaydi"
	MessageWarn5Min       = "5 daqiqadan keyin bugungi ekran vaqting tugaydi"
)

type blockedAppValue struct {
	App string `json:"app"`
}

type dailyLimitValue struct {
	Minutes float64 `json:"minutes"`
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

func (e *Enforcer) setStage(stage int) {
	e.mu.Lock()
	e.limitStage = stage
	e.mu.Unlock()
}
