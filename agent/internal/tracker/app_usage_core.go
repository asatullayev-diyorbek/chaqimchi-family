// app_usage_core.go holds the OS-independent half of app-usage tracking: the
// state machine that turns a stream of "this is the foreground app right
// now" observations into app_usage events (one per completed
// [started_at, ended_at) interval). It lives in its own file, with no build
// tag, because the observations don't have to come from this process:
// when cmd/agent runs as a Session 0 Windows service it can't call
// GetForegroundWindow itself, so a helper launched into the interactive
// session (see internal/session) streams the observations in over local IPC.
package tracker

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
)

// RunAppUsageFromObservations consumes foreground-app names from obs and
// appends an "app_usage" event to store whenever the foreground app changes,
// covering the just-finished [started_at, ended_at) window — identical
// output to RunAppUsage, but with the polling done elsewhere. onPoll, if
// non-nil, is called for every observation received (including ""), the same
// hook internal/rules.Enforcer is wired into from cmd/agent.
//
// A observation is expected roughly once per poll interval; the interval
// itself is whatever the producer uses. Timing of the emitted events comes
// from when observations arrive, so a stalled producer simply stops
// advancing the current interval rather than mis-attributing time.
// AppendIconEvent stores an "app_icon" event carrying a base64 PNG the agent
// extracted from an app's exe. Ingest folds these into one current icon per
// app (DeviceAppIcon) instead of a time series, and dedupes by sha256, so
// sending the same icon again is a cheap no-op.
func AppendIconEvent(store *buffer.Store, appID, sha256hex, pngB64 string) {
	if appID == "" || sha256hex == "" || pngB64 == "" {
		return
	}
	payload, _ := json.Marshal(map[string]any{
		"type":    "app_icon",
		"app_id":  appID,
		"sha256":  sha256hex,
		"png_b64": pngB64,
	})
	store.Append(buffer.Event{
		ID:        uuid.NewString(),
		Type:      "app_icon",
		Payload:   payload,
		CreatedAt: time.Now(),
	})
}

func RunAppUsageFromObservations(ctx context.Context, store *buffer.Store, obs <-chan string, onPoll func(app string)) {
	var currentApp string
	var startedAt time.Time

	flush := func(endedAt time.Time) {
		if currentApp == "" {
			return
		}
		payload, _ := json.Marshal(map[string]any{
			"type":             "app_usage",
			"app":              currentApp, // legacy alias during server transition
			"app_id":           currentApp,
			"app_name":         currentApp,
			"started_at":       startedAt.UTC().Format(time.RFC3339),
			"ended_at":         endedAt.UTC().Format(time.RFC3339),
			"duration_seconds": int(endedAt.Sub(startedAt).Seconds()),
		})
		store.Append(buffer.Event{
			ID:        uuid.NewString(),
			Type:      "app_usage",
			Payload:   payload,
			CreatedAt: endedAt,
		})
	}

	for {
		select {
		case <-ctx.Done():
			flush(time.Now())
			return
		case app, ok := <-obs:
			if !ok {
				flush(time.Now())
				return
			}
			now := time.Now()
			if app != currentApp {
				flush(now)
				currentApp = app
				startedAt = now
			}
			if onPoll != nil {
				onPoll(app)
			}
		}
	}
}
