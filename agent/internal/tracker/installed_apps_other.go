//go:build !windows

package tracker

// ScanInstalledApps is Windows-only in this build. The other platforms have
// no agent target yet, so this keeps the package compiling for tests and
// cross-checks on macOS/Linux.
func ScanInstalledApps() []InstalledAppInfo { return nil }
