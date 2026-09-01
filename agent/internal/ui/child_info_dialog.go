//go:build windows

package ui

import (
	"syscall"
	"unsafe"
)

// ShowChildStatus and ShowPrivacyNotice are deliberately informational:
// they explain the current state and data boundaries but expose no control
// that could stop or weaken the agent from the child-facing tray menu.
func ShowChildStatus(status Status) {
	heading, message := "Hammasi joyida", "ChaqimchiAI Child faol. Bugungi vaqt va qolgan limitni ota-onangizning ilovasida ko‘rishingiz mumkin."
	if status == StatusWarning {
		heading, message = "Ogohlantirish", "Bugungi qoida yoki limitga yaqin qoldingiz. Savol bo‘lsa, ota-onangiz bilan gaplashing."
	} else if status == StatusOffline {
		heading, message = "Internet aloqasi yo‘q", "ChaqimchiAI Child hozir internetga ulanmagan. Aloqa tiklanganda ma’lumotlar xavfsiz yuboriladi."
	}
	showInfoWindow("ChaqimchiAI Child — Holat", "BUGUNGI HOLAT", heading, message)
}

func ShowPrivacyNotice() {
	showInfoWindow("ChaqimchiAI Child — Shaffoflik", "NIMA KUZATILADI",
		"Ota-onam nimani ko‘radi?",
		"Ota-ona ilova va sayt nomlari, ekran vaqti hamda qurilma holatini ko‘rishi mumkin.\n\n"+
			"Xabarlar, parollar, kamera yoki mikrofon, bosilgan tugmalar kuzatilmaydi.\n\n"+
			"Bu ilova yashirin kuzatuv uchun emas. Savolingiz bo‘lsa, ota-onangiz bilan ochiq gaplashing.")
}

// ShowError presents a fatal installer error in GUI builds where there is no
// console to receive log output.
func ShowError(title, message string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBoxW := user32.NewProc("MessageBoxW")
	titlePtr, _ := syscall.UTF16PtrFromString(title)
	messagePtr, _ := syscall.UTF16PtrFromString(message)
	const mbOKError = 0x00000010
	messageBoxW.Call(0, uintptr(unsafe.Pointer(messagePtr)), uintptr(unsafe.Pointer(titlePtr)), mbOKError)
}

func showInfoDialog(title, message string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBoxW := user32.NewProc("MessageBoxW")
	titlePtr, _ := syscall.UTF16PtrFromString(title)
	messagePtr, _ := syscall.UTF16PtrFromString(message)
	const mbOKInfo = 0x00000040
	messageBoxW.Call(0, uintptr(unsafe.Pointer(messagePtr)), uintptr(unsafe.Pointer(titlePtr)), mbOKInfo)
}
