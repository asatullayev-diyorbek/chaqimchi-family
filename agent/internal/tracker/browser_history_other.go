//go:build !windows

package tracker

// collectBrowserVisits is Windows-only in this build. The other platforms
// have no agent target yet, so this keeps the package compiling for tests
// and cross-checks on macOS/Linux.
func collectBrowserVisits(checkpoints) ([]browserVisit, error) { return nil, nil }
