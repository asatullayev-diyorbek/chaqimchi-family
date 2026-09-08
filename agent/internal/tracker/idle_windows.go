//go:build windows

package tracker

import (
	"time"
	"unsafe"
)

var (
	procGetLastInputInfo = user32.NewProc("GetLastInputInfo")
	procGetTickCount     = kernel32.NewProc("GetTickCount")
)

type lastInputInfo struct {
	cbSize uint32
	dwTime uint32
}

// IdleDuration reports how long it has been since the last keyboard or mouse
// input on this session, or 0 if it can't be determined. It's used to stop
// attributing screen time while the child is away from the machine (the
// foreground window doesn't change when nobody's touching it).
//
// GetTickCount and dwTime are both millisecond counters that wrap after
// ~49.7 days; the unsigned subtraction stays correct across a single wrap.
func IdleDuration() time.Duration {
	info := lastInputInfo{cbSize: uint32(unsafe.Sizeof(lastInputInfo{}))}
	ret, _, _ := procGetLastInputInfo.Call(uintptr(unsafe.Pointer(&info)))
	if ret == 0 {
		return 0
	}
	tick, _, _ := procGetTickCount.Call()
	elapsed := uint32(tick) - info.dwTime
	return time.Duration(elapsed) * time.Millisecond
}
