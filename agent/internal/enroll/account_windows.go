//go:build windows

package enroll

import (
	"os"
	"os/exec"
	"strings"
)

// CurrentUserIsAdmin reports whether the Windows account running the
// installer belongs to the local Administrators group — used only so the
// backend can warn the parent that this account could stop the service or
// uninstall the agent outright (see the "child must use a Standard account"
// guidance). Never used to gate or change anything about the install.
//
// Deliberately queries the local group membership database ("net localgroup
// Administrators") rather than the current process's access token: the
// installer runs elevated via UAC, and an elevated token proves nothing
// about the account's own type — a Standard account never gets this far
// (UAC would prompt for a different admin's credentials instead), while a
// non-elevated admin account's *filtered* token can misreport membership.
// The member list "net localgroup" prints is always the literal account
// names regardless of Windows' display language, so this parses safely on
// any locale.
func CurrentUserIsAdmin() bool {
	username := os.Getenv("USERNAME")
	if username == "" {
		return false
	}
	out, err := exec.Command("net", "localgroup", "Administrators").Output()
	if err != nil {
		return false
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.EqualFold(strings.TrimSpace(line), username) {
			return true
		}
	}
	return false
}
