//go:build windows

package service

// Cross-compiled and type-checked only (see windows_service.go's doc
// comment on why that caveat matters generally). This mechanism is what
// actually closes the "child runs `sc stop`/clicks Stop in services.msc"
// gap: a clean SERVICE_CONTROL_STOP is handled gracefully by design (that
// is the whole point of a Stop control) and does NOT trigger the SCM's
// failure-recovery restart, unlike a crash or `taskkill /F` — those are
// already covered by recovery.go's DefaultRecoveryConfig.
//
// Deliberately not implemented as a Service Control Manager security
// descriptor (`sc sdset`): denying SERVICE_STOP to Administrators at the
// SCM level would also block this package's own Stop()/Delete()/Install()
// upgrade path, since none of them run *as* SYSTEM — they run as an
// elevated administrator, the same principal being denied. Untangling that
// with a second, narrower grant is exactly the kind of hand-written SDDL
// string that is easy to get subtly wrong and impossible to verify without
// a real Windows machine, for a security descriptor mistake that could
// leave a family unable to ever stop or reinstall the service. A marker
// file this package's own internal stop path writes right before it asks
// the SCM to deliver the Stop, checked by the running service's own
// Execute handler, achieves the same practical outcome without touching
// SCM permissions at all.

import (
	"os"
	"path/filepath"
	"time"
)

// authorizedStopMarker only needs to exist for the few hundred milliseconds
// between stopAndWait writing it and the SCM delivering the Stop control to
// Execute — ProgramData is used (not the service's configurable data dir)
// so this file has no dependency on any particular install's flags.
const authorizedStopMarker = `C:\ProgramData\Spino24\.agent-stop-authorized`

// authorizedStopMaxAge bounds how long a marker stays valid, so one left
// behind by a crash between being written and the SCM delivering Stop can
// never be replayed later to sneak an unauthorized stop past the check.
const authorizedStopMaxAge = 30 * time.Second

// authorizeNextStop is called by stopAndWait — the single low-level
// function Stop(), Delete(), and Install()'s upgrade-restart path all go
// through — immediately before requesting a stop through the SCM. Every
// caller of this Go code is by definition legitimate (a child has no way
// to invoke it directly, only the compiled installer/uninstaller does), so
// self-authorizing here is safe; an external `sc stop` never calls this
// function at all, so it never leaves a marker behind.
func authorizeNextStop() error {
	if err := os.MkdirAll(filepath.Dir(authorizedStopMarker), 0o700); err != nil {
		return err
	}
	return os.WriteFile(authorizedStopMarker, []byte(time.Now().UTC().Format(time.RFC3339)), 0o600)
}

// consumeStopAuthorization reports whether a fresh authorizeNextStop()
// marker exists, deleting it either way — single-use, so the next Stop
// request (authorized or not) always starts from a clean slate.
func consumeStopAuthorization() bool {
	data, err := os.ReadFile(authorizedStopMarker)
	_ = os.Remove(authorizedStopMarker)
	if err != nil {
		return false
	}
	t, err := time.Parse(time.RFC3339, string(data))
	if err != nil {
		return false
	}
	return time.Since(t) < authorizedStopMaxAge
}
