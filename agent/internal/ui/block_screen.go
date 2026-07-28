//go:build windows

package ui

// Everything in this file is hand-rolled Win32 (RegisterClassExW /
// CreateWindowExW / a manual message loop) rather than a GUI toolkit,
// because the only requirement here is a borderless, always-on-top,
// undismissable overlay — not a real application window. It has been
// cross-compiled for windows/amd64 and type-checks, but has NEVER been run
// on an actual Windows machine: struct layouts, window-class registration,
// and the paint routine are all unverified at runtime. Treat this as a
// reviewed draft, not a tested feature.

import (
	"sync"
	"syscall"
	"unsafe"
)

var (
	user32Block   = syscall.NewLazyDLL("user32.dll")
	gdi32Block    = syscall.NewLazyDLL("gdi32.dll")
	kernel32Block = syscall.NewLazyDLL("kernel32.dll")

	procRegisterClassExW = user32Block.NewProc("RegisterClassExW")
	procCreateWindowExW  = user32Block.NewProc("CreateWindowExW")
	procShowWindow       = user32Block.NewProc("ShowWindow")
	procUpdateWindow     = user32Block.NewProc("UpdateWindow")
	procGetMessageW      = user32Block.NewProc("GetMessageW")
	procTranslateMessage = user32Block.NewProc("TranslateMessage")
	procDispatchMessageW = user32Block.NewProc("DispatchMessageW")
	procDefWindowProcW   = user32Block.NewProc("DefWindowProcW")
	procPostQuitMessage  = user32Block.NewProc("PostQuitMessage")
	procGetSystemMetrics = user32Block.NewProc("GetSystemMetrics")
	procBeginPaint       = user32Block.NewProc("BeginPaint")
	procEndPaint         = user32Block.NewProc("EndPaint")
	procDrawTextW        = user32Block.NewProc("DrawTextW")
	procDestroyWindow    = user32Block.NewProc("DestroyWindow")
	procSendMessageW     = user32Block.NewProc("SendMessageW")

	procCreateSolidBrush = gdi32Block.NewProc("CreateSolidBrush")
	procSetTextColor     = gdi32Block.NewProc("SetTextColor")
	procSetBkMode        = gdi32Block.NewProc("SetBkMode")

	procGetModuleHandleW = kernel32Block.NewProc("GetModuleHandleW")
)

const (
	smCXScreen = 0
	smCYScreen = 1

	wsPopup     = 0x80000000
	wsVisible   = 0x10000000
	wsExTopmost = 0x00000008

	wmDestroy = 0x0002
	wmPaint   = 0x000F
	wmClose   = 0x0010

	swShow = 5

	dtCenter     = 0x00000001
	dtVCenter    = 0x00000004
	dtSingleLine = 0x00000020

	bkModeTransparent = 1
)

type wndClassExW struct {
	cbSize        uint32
	style         uint32
	lpfnWndProc   uintptr
	cbClsExtra    int32
	cbWndExtra    int32
	hInstance     uintptr
	hIcon         uintptr
	hCursor       uintptr
	hbrBackground uintptr
	lpszMenuName  *uint16
	lpszClassName *uint16
	hIconSm       uintptr
}

type msgT struct {
	hwnd    uintptr
	message uint32
	wParam  uintptr
	lParam  uintptr
	time    uint32
	pt      pointT
}

type pointT struct{ x, y int32 }

type rectT struct{ left, top, right, bottom int32 }

type paintStructT struct {
	hdc         uintptr
	fErase      int32
	rcPaint     rectT
	fRestore    int32
	fIncUpdate  int32
	rgbReserved [32]byte
}

const blockClassName = "ChaqimchiBlockScreen"

var (
	blockScreenMu    sync.Mutex
	currentBlockHwnd uintptr
	currentBlockText string
	classRegistered  bool
)

// BlockScreen shows a fullscreen, borderless, always-on-top overlay with
// the given message and blocks the calling goroutine until Close() is
// called from elsewhere. There is deliberately no close button, title bar,
// or system menu — WS_POPUP has none of those to begin with, and WM_CLOSE
// is only ever sent programmatically via Close() — matching the bola-app
// doc's "no way for the child to dismiss it themselves" requirement.
func BlockScreen(message string) {
	blockScreenMu.Lock()
	currentBlockText = message
	blockScreenMu.Unlock()

	hInstance, _, _ := procGetModuleHandleW.Call(0)

	if !classRegistered {
		wndProcPtr := syscall.NewCallback(blockWndProc)
		className, _ := syscall.UTF16PtrFromString(blockClassName)
		blackBrush, _, _ := procCreateSolidBrush.Call(0x00000000)
		wc := wndClassExW{
			cbSize:        uint32(unsafe.Sizeof(wndClassExW{})),
			lpfnWndProc:   wndProcPtr,
			hInstance:     hInstance,
			hbrBackground: blackBrush,
			lpszClassName: className,
		}
		procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
		classRegistered = true
	}

	screenW, _, _ := procGetSystemMetrics.Call(smCXScreen)
	screenH, _, _ := procGetSystemMetrics.Call(smCYScreen)

	className, _ := syscall.UTF16PtrFromString(blockClassName)
	title, _ := syscall.UTF16PtrFromString("ChaqimchiAI")

	hwnd, _, _ := procCreateWindowExW.Call(
		wsExTopmost,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(title)),
		wsPopup|wsVisible,
		0, 0, screenW, screenH,
		0, 0, hInstance, 0,
	)

	blockScreenMu.Lock()
	currentBlockHwnd = hwnd
	blockScreenMu.Unlock()

	procShowWindow.Call(hwnd, swShow)
	procUpdateWindow.Call(hwnd)

	var m msgT
	for {
		ret, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if ret == 0 {
			break
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}

	blockScreenMu.Lock()
	currentBlockHwnd = 0
	blockScreenMu.Unlock()
}

// Close ends whichever block screen is currently showing, if any — called
// once the underlying condition clears (e.g. a new day resets the daily
// limit). No-op if nothing is showing.
func Close() {
	blockScreenMu.Lock()
	hwnd := currentBlockHwnd
	blockScreenMu.Unlock()
	if hwnd == 0 {
		return
	}
	procSendMessageW.Call(hwnd, wmClose, 0, 0)
}

func blockWndProc(hwnd, message, wParam, lParam uintptr) uintptr {
	switch uint32(message) {
	case wmClose:
		procDestroyWindow.Call(hwnd)
		return 0
	case wmDestroy:
		procPostQuitMessage.Call(0)
		return 0
	case wmPaint:
		var ps paintStructT
		hdc, _, _ := procBeginPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))

		procSetBkMode.Call(hdc, bkModeTransparent)
		procSetTextColor.Call(hdc, 0x00ffffff) // white text on the black background

		blockScreenMu.Lock()
		text := currentBlockText
		blockScreenMu.Unlock()
		textPtr, _ := syscall.UTF16PtrFromString(text)

		paintRect := ps.rcPaint
		procDrawTextW.Call(
			hdc,
			uintptr(unsafe.Pointer(textPtr)),
			uintptr(len([]rune(text))),
			uintptr(unsafe.Pointer(&paintRect)),
			uintptr(dtCenter|dtVCenter|dtSingleLine),
		)

		procEndPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		return 0
	default:
		ret, _, _ := procDefWindowProcW.Call(hwnd, message, wParam, lParam)
		return ret
	}
}
