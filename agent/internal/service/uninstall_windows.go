//go:build windows

package service

// Cross-compiled and type-checked only — see windows_service.go's doc
// comment for why that caveat matters here specifically: Delete is the
// other half of Install, and an uninstall path that silently fails to
// remove the SCM registration would leave a family unable to get the
// agent off a machine at all.

import (
	"errors"
	"fmt"
	"log"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc/mgr"
)

// Delete stops the named service (if running) and removes its SCM
// registration entirely. A no-op if the service was never installed.
// Callers that need to notify the backend before the agent goes away
// (see cmd/agent's -uninstall flow) must do so *before* calling Delete —
// once the service is gone there is no running process left to report
// through.
func Delete(name string) error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connecting to service control manager: %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(name)
	if err != nil {
		if errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
			return nil
		}
		return fmt.Errorf("opening service %q: %w", name, err)
	}
	defer s.Close()

	if err := stopAndWait(s); err != nil {
		return fmt.Errorf("stopping service before delete: %w", err)
	}
	if err := s.Delete(); err != nil {
		return fmt.Errorf("deleting service: %w", err)
	}
	if err := UnregisterSafeBoot(name); err != nil {
		log.Printf("safe boot unregistration: %v", err)
	}
	UnregisterWatchdogTask()
	return nil
}
