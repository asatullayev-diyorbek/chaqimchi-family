//go:build !windows

package enroll

// CurrentUserIsAdmin has no meaningful value off Windows (see
// account_windows.go — the agent only ships for Windows today).
func CurrentUserIsAdmin() bool { return false }
