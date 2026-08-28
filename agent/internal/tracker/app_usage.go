//go:build windows

// Package tracker polls OS state and hands finished observations to the
// buffer as events. app_usage.go watches which process owns the foreground
// window; when it changes, the previous app's start/end window becomes one
// "app_usage" event. The event state machine itself lives in
// app_usage_core.go so it can also be fed from another process (see
// internal/session) when the agent runs as a Session 0 service.
package tracker

import (
	"context"
	"syscall"
	"time"
	"unsafe"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
)

var (
	user32                        = syscall.NewLazyDLL("user32.dll")
	kernel32                      = syscall.NewLazyDLL("kernel32.dll")
	procGetForegroundWindow       = user32.NewProc("GetForegroundWindow")
	procGetWindowThreadProcessId  = user32.NewProc("GetWindowThreadProcessId")
	procOpenProcess               = kernel32.NewProc("OpenProcess")
	procQueryFullProcessImageName = kernel32.NewProc("QueryFullProcessImageNameW")
	procCloseHandle               = kernel32.NewProc("CloseHandle")
)

const (
	processQueryLimitedInformation = 0x1000
)

// ForegroundProcessName returns the executable name (e.g. "chrome.exe") of
// the process currently owning the foreground window, or "" if it can't be
// determined (no window focused, permission denied, or — importantly —
// being called from Session 0, which has no interactive foreground window).
func ForegroundProcessName() string {
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
// "app_usage" event to store whenever the foreground app changes. onPoll, if
// non-nil, is called on every tick with the currently observed foreground
// app name — the hook internal/rules.Enforcer.CheckForegroundApp is wired
// into from cmd/agent. This is the in-process path used when cmd/agent runs
// interactively (a real user session); the service path feeds
// RunAppUsageFromObservations from a session helper instead.
func RunAppUsage(ctx context.Context, store *buffer.Store, pollInterval time.Duration, onPoll func(app string)) {
	obs := make(chan string)
	go func() {
		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				select {
				case obs <- ForegroundProcessName():
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	RunAppUsageFromObservations(ctx, store, obs, onPoll)
}
