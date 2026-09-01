//go:build windows

package enroll

import (
	"crypto/sha256"
	"encoding/hex"

	"golang.org/x/sys/windows/registry"
)

// HardwareID is a stable, non-reversible per-machine fingerprint: the
// SHA-256 of the Windows MachineGuid (written once at OS install, unchanged
// by our app's install/uninstall). The installer sends it with generate-code
// so a re-install on the same computer reuses its device row instead of
// leaving an orphan. Returns "" if the registry value can't be read.
func HardwareID() string {
	k, err := registry.OpenKey(
		registry.LOCAL_MACHINE,
		`SOFTWARE\Microsoft\Cryptography`,
		registry.QUERY_VALUE|registry.WOW64_64KEY,
	)
	if err != nil {
		return ""
	}
	defer k.Close()

	guid, _, err := k.GetStringValue("MachineGuid")
	if err != nil || guid == "" {
		return ""
	}
	sum := sha256.Sum256([]byte("chaqimchi:" + guid))
	return hex.EncodeToString(sum[:])
}
