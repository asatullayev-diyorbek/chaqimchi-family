//go:build windows

package service

// Cross-compiled and type-checked only (see windows_service.go). The
// SafeBoot registry keys are Windows' own, documented mechanism for
// opting a service into Safe Mode (both "Minimal" and "Network with
// Networking") — by default only Microsoft-signed drivers/services start
// there, which would otherwise hand a child a built-in way to boot right
// past the agent.

import (
	"fmt"

	"golang.org/x/sys/windows/registry"
)

var safeBootModes = []string{"Minimal", "Network"}

// RegisterSafeBoot makes the named service start in both Safe Mode
// variants too. Errors from one mode don't stop the attempt on the other,
// so a partial registry-permission issue leaves at least one variant
// covered rather than none.
func RegisterSafeBoot(name string) error {
	var firstErr error
	for _, mode := range safeBootModes {
		path := `SYSTEM\CurrentControlSet\Control\SafeBoot\` + mode + `\` + name
		k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, path, registry.SET_VALUE)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("registering safe boot (%s): %w", mode, err)
			}
			continue
		}
		// The (Default) value just needs to exist; "Service" is the
		// conventional content Windows itself writes for its own services
		// registered this way.
		err = k.SetStringValue("", "Service")
		k.Close()
		if err != nil && firstErr == nil {
			firstErr = fmt.Errorf("setting safe boot value (%s): %w", mode, err)
		}
	}
	return firstErr
}

// UnregisterSafeBoot removes the Safe Mode registration for both variants.
// Safe to call even if it was never created.
func UnregisterSafeBoot(name string) error {
	var firstErr error
	for _, mode := range safeBootModes {
		path := `SYSTEM\CurrentControlSet\Control\SafeBoot\` + mode + `\` + name
		if err := registry.DeleteKey(registry.LOCAL_MACHINE, path); err != nil && err != registry.ErrNotExist && firstErr == nil {
			firstErr = fmt.Errorf("removing safe boot (%s): %w", mode, err)
		}
	}
	return firstErr
}
