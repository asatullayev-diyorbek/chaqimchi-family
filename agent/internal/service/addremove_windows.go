//go:build windows

package service

// Cross-compiled and type-checked only (see windows_service.go). This file
// exists specifically so a real Add/Remove Programs entry always ships
// alongside any future stop/uninstall hardening — see the design note in
// docs on why a family must always have a legitimate, discoverable way to
// remove the agent before the service is ever made harder to stop.

import (
	"fmt"

	"golang.org/x/sys/windows/registry"
)

// uninstallKeyPath is the well-known location Windows' "Apps & Features" /
// "Programs and Features" scans for entries to list. The key name (last
// path segment) just needs to be a unique, stable identifier — it is never
// shown to the user; DisplayName is.
const uninstallKeyPath = `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ChaqimchiAIGuard`

// RegisterUninstaller writes (or overwrites) the Add/Remove Programs entry.
// uninstallCommand is the full command line Windows runs when the parent
// clicks "Uninstall" — the installed agent binary invoked with -uninstall —
// and must already be quoted/escaped as a shell command line, not a bare
// path. iconPath, if non-empty, is shown next to the entry.
func RegisterUninstaller(displayVersion, uninstallCommand, iconPath string) error {
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, uninstallKeyPath, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("creating uninstall registry key: %w", err)
	}
	defer k.Close()

	for name, value := range map[string]string{
		"DisplayName":     "ChaqimchiAI Guard",
		"DisplayVersion":  displayVersion,
		"Publisher":       "ChaqimchiAI",
		"UninstallString": uninstallCommand,
		"DisplayIcon":     iconPath,
	} {
		if value == "" {
			continue
		}
		if err := k.SetStringValue(name, value); err != nil {
			return fmt.Errorf("writing %s: %w", name, err)
		}
	}
	// Windows only shows a "Change" button when it finds a ModifyPath value;
	// there is nothing to modify here, and NoRepair suppresses the
	// (equally inapplicable) "Repair" option some shells offer.
	if err := k.SetDWordValue("NoModify", 1); err != nil {
		return fmt.Errorf("writing NoModify: %w", err)
	}
	if err := k.SetDWordValue("NoRepair", 1); err != nil {
		return fmt.Errorf("writing NoRepair: %w", err)
	}
	return nil
}

// UnregisterUninstaller removes the Add/Remove Programs entry. Safe to call
// even if it was never created.
func UnregisterUninstaller() error {
	if err := registry.DeleteKey(registry.LOCAL_MACHINE, uninstallKeyPath); err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return fmt.Errorf("deleting uninstall registry key: %w", err)
	}
	return nil
}
