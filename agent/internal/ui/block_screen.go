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
	"strings"
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
	procCreateFontW      = gdi32Block.NewProc("CreateFontW")
	procSelectObject     = gdi32Block.NewProc("SelectObject")
	procDeleteObject     = gdi32Block.NewProc("DeleteObject")
	procGetDeviceCaps    = gdi32Block.NewProc("GetDeviceCaps")
	procGetStockObject   = gdi32Block.NewProc("GetStockObject")
	procRoundRect        = gdi32Block.NewProc("RoundRect")
	procEllipse          = gdi32Block.NewProc("Ellipse")

	procGetModuleHandleW = kernel32Block.NewProc("GetModuleHandleW")
)

// Brand palette as GDI COLORREF (0x00BBGGRR).
const (
	blockBgColor   = 0x005E5F0A // deep teal — matches theme colorAccentDark
	blockHeadColor = 0x00FFFFFF // white
	blockBodyColor = 0x00E8E9C7 // muted teal-tint (theme colorAccentSub)
	blockMarkColor = 0x00CFDCDB // faint, for the wordmark

	// Reason accents for the symbol chip, matching webui/style.css's
	// .block-symbol (amber, daily_limit) and .blocked .block-symbol (blue,
	// blocked_app): a tinted rounded chip with a solid dot in the accent
	// colour — GDI has no easy path for the actual solar icon glyph.
	blockAmberChip = 0x00CBF0FF // #fff0cb
	blockAmberDot  = 0x0026A9EF // #efa926
	blockBlueChip  = 0x00FFF5E8 // #e8f5ff
	blockBlueDot   = 0x00E48E4D // #4d8ee4

	logPixelsY        = 90
	defaultCharset    = 1
	cleartypeQuality  = 5
	fwNormal          = 400
	fwSemibold        = 600
	fwBold            = 700
	nullPen           = 8 // GetStockObject stock object id
	dtSingleLine      = 0x00000020
	blockSideMarginPc = 12 // % of width kept clear on each side of the heading
	chipSize          = 84
	chipGap           = 22
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

	dtCenter    = 0x00000001
	dtCalcRect  = 0x00000400
	dtWordBreak = 0x00000010

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
	blockScreenMu      sync.Mutex
	currentBlockHwnd   uintptr
	currentBlockText   string
	currentBlockReason string
	classRegistered    bool
)

// BlockScreen shows a fullscreen, borderless, always-on-top overlay with the
// given message and blocks the calling goroutine until Close() is called
// from elsewhere. There is deliberately no close button, title bar, or
// system menu — WS_POPUP has none of those to begin with, and WM_CLOSE is
// only ever sent programmatically via Close() — matching the bola-app doc's
// "no way for the child to dismiss it themselves" requirement.
//
// reason is the same string internal/rules.Enforcer passes to BlockFunc
// ("daily_limit" or "blocked_app") and only picks the symbol chip's accent
// colour (webui/limit-reached.html vs app-restricted.html); any other value
// falls back to the amber daily-limit look.
func BlockScreen(reason, message string) {
	blockScreenMu.Lock()
	currentBlockText = message
	currentBlockReason = reason
	blockScreenMu.Unlock()

	hInstance, _, _ := procGetModuleHandleW.Call(0)

	if !classRegistered {
		wndProcPtr := syscall.NewCallback(blockWndProc)
		className, _ := syscall.UTF16PtrFromString(blockClassName)
		bgBrush, _, _ := procCreateSolidBrush.Call(blockBgColor)
		wc := wndClassExW{
			cbSize:        uint32(unsafe.Sizeof(wndClassExW{})),
			lpfnWndProc:   wndProcPtr,
			hInstance:     hInstance,
			hbrBackground: bgBrush,
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
		paintBlockScreen(hdc)
		procEndPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		return 0
	default:
		ret, _, _ := procDefWindowProcW.Call(hwnd, message, wParam, lParam)
		return ret
	}
}

// paintBlockScreen draws the branded overlay: a faint wordmark near the top,
// then a large heading and a calmer sub-line, vertically centred as a block.
// It leans on the window class's teal background brush for the fill.
func paintBlockScreen(hdc uintptr) {
	blockScreenMu.Lock()
	head, body := splitBlockMessage(currentBlockText)
	reason := currentBlockReason
	blockScreenMu.Unlock()

	chipFill, chipDot := uintptr(blockAmberChip), uintptr(blockAmberDot)
	if reason == "blocked_app" {
		chipFill, chipDot = blockBlueChip, blockBlueDot
	}

	screenW, _, _ := procGetSystemMetrics.Call(smCXScreen)
	screenH, _, _ := procGetSystemMetrics.Call(smCYScreen)
	w, h := int32(screenW), int32(screenH)

	dpiY, _, _ := procGetDeviceCaps.Call(hdc, logPixelsY)
	markFont := createBlockFont(int(dpiY), 13, fwSemibold)
	headFont := createBlockFont(int(dpiY), 34, fwBold)
	bodyFont := createBlockFont(int(dpiY), 16, fwNormal)
	old, _, _ := procSelectObject.Call(hdc, markFont)
	defer func() {
		procSelectObject.Call(hdc, old)
		procDeleteObject.Call(markFont)
		procDeleteObject.Call(headFont)
		procDeleteObject.Call(bodyFont)
	}()

	procSetBkMode.Call(hdc, bkModeTransparent)

	// Wordmark.
	procSelectObject.Call(hdc, markFont)
	procSetTextColor.Call(hdc, blockMarkColor)
	markRect := rectT{left: 0, top: h / 12, right: w, bottom: h/12 + 60}
	drawBlockText(hdc, "CHAQIMCHIAI  GUARD", &markRect, dtCenter|dtSingleLine)

	side := w * blockSideMarginPc / 100
	headW := w - 2*side
	bodyW := headW * 82 / 100
	bodySide := (w - bodyW) / 2

	procSelectObject.Call(hdc, headFont)
	headH := measureBlockText(hdc, head, headW, dtCenter|dtWordBreak)
	procSelectObject.Call(hdc, bodyFont)
	bodyH := int32(0)
	if body != "" {
		bodyH = measureBlockText(hdc, body, bodyW, dtCenter|dtWordBreak)
	}

	gap := int32(0)
	if body != "" {
		gap = h / 28
	}
	total := chipSize + chipGap + headH + gap + bodyH
	blockTop := (h - total) / 2
	top := blockTop + chipSize + chipGap

	// Symbol chip: a tinted rounded square with a solid accent dot, standing
	// in for the solar icon glyph webui uses (GDI has no easy path to that).
	nilPen, _, _ := procGetStockObject.Call(nullPen)
	oldPen, _, _ := procSelectObject.Call(hdc, nilPen)
	chipBrush, _, _ := procCreateSolidBrush.Call(chipFill)
	oldBrush, _, _ := procSelectObject.Call(hdc, chipBrush)
	chipLeft := w/2 - chipSize/2
	procRoundRect.Call(hdc, uintptr(chipLeft), uintptr(blockTop), uintptr(chipLeft+chipSize), uintptr(blockTop+chipSize), 28, 28)
	dotBrush, _, _ := procCreateSolidBrush.Call(chipDot)
	procSelectObject.Call(hdc, dotBrush)
	dotSize := int32(30)
	dotLeft, dotTop := w/2-dotSize/2, blockTop+chipSize/2-dotSize/2
	procEllipse.Call(hdc, uintptr(dotLeft), uintptr(dotTop), uintptr(dotLeft+dotSize), uintptr(dotTop+dotSize))
	procSelectObject.Call(hdc, oldBrush)
	procSelectObject.Call(hdc, oldPen)
	procDeleteObject.Call(chipBrush)
	procDeleteObject.Call(dotBrush)

	procSelectObject.Call(hdc, headFont)
	procSetTextColor.Call(hdc, blockHeadColor)
	headRect := rectT{left: side, top: top, right: side + headW, bottom: top + headH}
	drawBlockText(hdc, head, &headRect, dtCenter|dtWordBreak)

	if body != "" {
		procSelectObject.Call(hdc, bodyFont)
		procSetTextColor.Call(hdc, blockBodyColor)
		bodyTop := top + headH + gap
		bodyRect := rectT{left: bodySide, top: bodyTop, right: bodySide + bodyW, bottom: bodyTop + bodyH}
		drawBlockText(hdc, body, &bodyRect, dtCenter|dtWordBreak)
	}
}

// splitBlockMessage divides an enforcer message into a heading and a calmer
// follow-up on the first blank line (see internal/rules.MessageLimitReached).
func splitBlockMessage(s string) (head, body string) {
	if i := strings.Index(s, "\n\n"); i >= 0 {
		return strings.TrimSpace(s[:i]), strings.TrimSpace(s[i+2:])
	}
	return strings.TrimSpace(s), ""
}

func createBlockFont(dpiY, pointSize, weight int) uintptr {
	height := -(dpiY * pointSize / 72)
	face, _ := syscall.UTF16PtrFromString("Segoe UI")
	f, _, _ := procCreateFontW.Call(
		uintptr(height), 0, 0, 0, uintptr(weight),
		0, 0, 0,
		defaultCharset, 0, 0, cleartypeQuality, 0,
		uintptr(unsafe.Pointer(face)),
	)
	return f
}

func drawBlockText(hdc uintptr, s string, r *rectT, format uintptr) {
	if s == "" {
		return
	}
	p, _ := syscall.UTF16PtrFromString(s)
	procDrawTextW.Call(hdc, uintptr(unsafe.Pointer(p)), uintptr(len([]rune(s))), uintptr(unsafe.Pointer(r)), format)
}

func measureBlockText(hdc uintptr, s string, width int32, format uintptr) int32 {
	r := rectT{left: 0, top: 0, right: width, bottom: 0}
	drawBlockText(hdc, s, &r, format|dtCalcRect)
	return r.bottom - r.top
}
