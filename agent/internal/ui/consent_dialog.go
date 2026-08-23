//go:build windows

package ui

import (
	"fmt"
	"syscall"
	"unsafe"
)

// RequireInstallerConsent presents the non-skippable transparency notice
// before enrollment credentials are created. It deliberately uses the native
// Windows dialog here: cmd/installer has no GUI framework yet, while the
// full visual specification remains in child-ui/consent.html for the future
// wizard shell. Returning false means the user declined, so installation
// must stop before any service or device credential is created.
func RequireInstallerConsent() (bool, error) {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBoxW := user32.NewProc("MessageBoxW")

	const (
		mbYesNo      = 0x00000004
		mbIconInfo   = 0x00000040
		mbDefButton2 = 0x00000100
		idYes        = 6
	)

	text, err := syscall.UTF16PtrFromString("ChaqimchiAI Family shaffof ishlaydi.\n\nOta-ona ko‘rishi mumkin:\n• ilova va sayt nomlari\n• ekran vaqti\n• qurilma holati\n\nOta-ona ko‘rmaydi:\n• xabarlar va chatlar\n• parollar\n• kamera yoki mikrofon\n• bosilgan tugmalar\n\nDavom etish uchun ushbu ma’lumotni o‘qib, roziligingizni tasdiqlang.")
	if err != nil {
		return false, fmt.Errorf("consent text: %w", err)
	}
	title, err := syscall.UTF16PtrFromString("ChaqimchiAI Family — Shaffoflik va rozilik")
	if err != nil {
		return false, fmt.Errorf("consent title: %w", err)
	}

	result, _, callErr := messageBoxW.Call(
		0,
		uintptr(unsafe.Pointer(text)),
		uintptr(unsafe.Pointer(title)),
		mbYesNo|mbIconInfo|mbDefButton2,
	)
	if result == 0 {
		return false, fmt.Errorf("showing consent dialog: %w", callErr)
	}
	return result == idYes, nil
}
