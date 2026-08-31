//go:build windows

package tracker

import (
	"runtime"

	"golang.org/x/sys/windows"
)

// InitShellCOM pins the calling goroutine to its OS thread and initialises a
// COM apartment on it. SHGetFileInfo with SHGFI_ICON needs COM initialised
// on the calling thread — without it the call returns a null HICON in a
// process that has no message pump (the -foreground-reporter helper the
// service spawns is exactly that). Interactive apps usually get away with
// it because something else already initialised COM.
//
// Call once at the top of the long-lived goroutine that will call
// ExtractIconPNG, and keep that goroutine alive: the apartment lives as
// long as the thread. Safe to call when COM is already initialised on the
// thread (RPC_E_CHANGED_MODE / S_FALSE are both fine and ignored here).
func InitShellCOM() {
	runtime.LockOSThread()
	// COINIT_APARTMENTTHREADED is what the shell expects. A non-nil error
	// here is almost always "already initialised on this thread", which is
	// harmless for our read-only icon use.
	_ = windows.CoInitializeEx(0, windows.COINIT_APARTMENTTHREADED)
}
