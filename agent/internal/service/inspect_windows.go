//go:build windows

package service

import (
	"errors"
	"fmt"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

// Info describes an agent service that is already registered with the SCM.
type Info struct {
	Installed  bool
	Running    bool
	BinaryPath string   // full command line as stored in the SCM
	Args       []string // parsed arguments after the executable path
}

// Inspect reports whether the named service exists and, if so, its state and
// the argument list it was configured with. A re-install uses Args to keep
// the machine bound to the same enrolled device instead of forcing the
// operator through pairing again.
func Inspect(name string) (Info, error) {
	m, err := mgr.Connect()
	if err != nil {
		return Info{}, fmt.Errorf("connecting to service control manager: %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(name)
	if err != nil {
		if errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
			return Info{}, nil
		}
		return Info{}, fmt.Errorf("opening service %q: %w", name, err)
	}
	defer s.Close()

	info := Info{Installed: true}
	if cfg, cfgErr := s.Config(); cfgErr == nil {
		info.BinaryPath = cfg.BinaryPathName
		if parts, decErr := windows.DecomposeCommandLine(cfg.BinaryPathName); decErr == nil && len(parts) > 1 {
			info.Args = parts[1:]
		}
	}
	if st, qErr := s.Query(); qErr == nil {
		info.Running = st.State != svc.Stopped
	}
	return info, nil
}

// Stop stops the named service and waits for it to report SERVICE_STOPPED.
// It is a no-op if the service is not installed or already stopped, so an
// installer can call it unconditionally before it replaces the binary.
func Stop(name string) error {
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
	return stopAndWait(s)
}
