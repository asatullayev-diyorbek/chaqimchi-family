//go:build windows

// Package tracker polls OS state and hands finished observations to the
// buffer as events. app_usage.go watches which process owns the foreground
// window; when it changes, the previous app's start/end window becomes one
// "app_usage" event.
package tracker

import (
	"context"
	"encoding/json"
	"syscall"
	"time"
	"unsafe"

	"github.com/google/uuid"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
)

var (
	user32                       = syscall.NewLazyDLL("user32.dll")
	kernel32                     = syscall.NewLazyDLL("kernel32.dll")
	procGetForegroundWindow      = user32.NewProc("GetForegroundWindow")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
	procOpenProcess              = kernel32.NewProc("OpenProcess")
	procQueryFullProcessImageName = kernel32.NewProc("QueryFullProcessImageNameW")
	procCloseHandle              = kernel32.NewProc("CloseHandle")
)

const (
	processQueryLimitedInformation = 0x1000
)

// foregroundProcessName returns the executable name (e.g. "chrome.exe") of
// the process currently owning the foreground window, or "" if it can't be
// determined (no window focused, permission denied, etc).
func foregroundProcessName() string {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd == 0 {
		return ""
	}

	var pid uint32
	procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid == 0 {
		return ""
	}

	handle, _, _ := procOpenProcess.Call(processQueryLimitedInformation, 0, uintptr(pid))
	if handle == 0 {
		return ""
	}
	defer procCloseHandle.Call(handle)

	buf := make([]uint16, 260)
	size := uint32(len(buf))
	ret, _, _ := procQueryFullProcessImageName.Call(
		handle, 0, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)),
	)
	if ret == 0 {
		return ""
	}

	full := syscall.UTF16ToString(buf[:size])
	for i := len(full) - 1; i >= 0; i-- {
		if full[i] == '\\' {
			return full[i+1:]
		}
	}
	return full
}

// RunAppUsage polls the foreground app every pollInterval and appends an
// "app_usage" event to store whenever the foreground app changes, covering
// the just-finished [started_at, ended_at) window. If onPoll is non-nil, it
// is called on every tick with the currently observed foreground app name
// (possibly "") — this is the hook internal/rules.Enforcer.CheckForegroundApp
// is wired into from cmd/agent, so blocked-app enforcement reacts on the
// same cadence as usage tracking rather than needing its own poll loop.
func RunAppUsage(ctx context.Context, store *buffer.Store, pollInterval time.Duration, onPoll func(app string)) {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	var currentApp string
	var startedAt time.Time

	flush := func(endedAt time.Time) {
		if currentApp == "" {
			return
		}
		payload, _ := json.Marshal(map[string]any{
			"type":       "app_usage",
			"app":        currentApp,
			"started_at": startedAt.UTC().Format(time.RFC3339),
			"ended_at":   endedAt.UTC().Format(time.RFC3339),
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
		case now := <-ticker.C:
			app := foregroundProcessName()
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
