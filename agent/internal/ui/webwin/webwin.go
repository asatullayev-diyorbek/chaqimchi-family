//go:build windows

// Package webwin renders the embedded webui/ pages as fixed-size, chromeless
// WebView2 windows and wires a small JSON bridge to Go. It replaces the
// hand-built walk dialogs — see docs/webview-ui-plan.md.
package webwin

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"unsafe"

	"github.com/chaqimchi/chaqimchi-family/agent/webui"
	webview "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

var (
	user32              = windows.NewLazySystemDLL("user32.dll")
	procGetDpiForWindow = user32.NewProc("GetDpiForWindow")
	procGetWindowRect   = user32.NewProc("GetWindowRect")
	procSetWindowPos    = user32.NewProc("SetWindowPos")
	procGetSystemMetric = user32.NewProc("GetSystemMetrics")
	procPostMessageW    = user32.NewProc("PostMessageW")
)

const wmClose = 0x0010

// ErrUnavailable means a WebView2 window could not be created — almost always
// because the WebView2 runtime is not installed. Callers fall back to walk.
var ErrUnavailable = errors.New("WebView2 mavjud emas")

// One loopback file server for the whole process serves the embedded pages
// so relative links (style.css, assets/*) resolve.
var (
	serverOnce sync.Once
	serverBase string
	serverErr  error
)

func pagesBaseURL() (string, error) {
	serverOnce.Do(func() {
		ln, err := net.Listen("tcp4", "127.0.0.1:0")
		if err != nil {
			serverErr = fmt.Errorf("ui server: %w", err)
			return
		}
		serverBase = "http://" + ln.Addr().String() + "/"
		srv := &http.Server{Handler: noStore(http.FileServer(http.FS(webui.Files)))}
		go func() { _ = srv.Serve(ln) }()
	})
	return serverBase, serverErr
}

func noStore(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		h.ServeHTTP(w, r)
	})
}

// Options configures a window.
type Options struct {
	Page   string // embedded page, e.g. "welcome.html"
	Title  string
	Width  int
	Height int
}

// Window is one open app window. It can be navigated between embedded pages
// while it stays open — the installer is one window walking welcome.html ->
// consent.html -> ... rather than a stack of separate windows.
type Window struct {
	wv     webview.WebView
	base   string // loopback URL prefix, e.g. http://127.0.0.1:PORT/
	page   string // initial page; "" means the caller navigates explicitly
	mu     sync.Mutex
	closed bool
}

// New creates the window sized for opts.Page but does NOT navigate to it yet
// — Run() does that, after OnAction has registered its binding. (go-webview2
// injects the goAction bridge as a "run on every new document" script; if the
// page has already started loading when Bind is called, this document misses
// it and window.ui.action(...) silently no-ops.) Returns an error if the
// WebView2 runtime is missing or the window can't be created.
func New(opts Options) (*Window, error) {
	base, err := pagesBaseURL()
	if err != nil {
		return nil, err
	}
	if opts.Width == 0 {
		opts.Width = 960
	}
	if opts.Height == 0 {
		opts.Height = 620
	}
	wv := webview.NewWithOptions(webview.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		DataPath:  webView2DataPath(),
		WindowOptions: webview.WindowOptions{
			Title:  opts.Title,
			Width:  uint(opts.Width),
			Height: uint(opts.Height),
			Center: true,
		},
	})
	if wv == nil {
		return nil, ErrUnavailable
	}
	// opts.Width/Height are CSS pixels (the page's design size). go-webview2
	// sizes the native window in physical pixels and does not scale for DPI,
	// so on a 150% display a "960" window gives the page only 640 CSS px and
	// trips its mobile breakpoint. Scale the window by the monitor DPI so the
	// page always gets the CSS size it was designed for.
	hwnd := uintptr(wv.Window())
	scale := dpiScale(hwnd)
	pw, ph := int(float64(opts.Width)*scale+0.5), int(float64(opts.Height)*scale+0.5)
	wv.SetSize(pw, ph, webview.HintFixed)
	recenter(hwnd)
	return &Window{wv: wv, base: base, page: opts.Page}, nil
}

// webView2DataPath pins every window in the process to one user-data folder,
// so sequential windows share a single browser process instead of each
// spinning up an environment against the default per-exe folder.
func webView2DataPath() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = os.TempDir()
	}
	return filepath.Join(base, "ChaqimchiAI", "WebView2")
}

func dpiScale(hwnd uintptr) float64 {
	if procGetDpiForWindow.Find() != nil {
		return 1
	}
	dpi, _, _ := procGetDpiForWindow.Call(hwnd)
	if dpi < 96 {
		return 1
	}
	return float64(dpi) / 96
}

// recenter re-positions the window on the primary monitor after SetSize
// (which keeps the top-left corner, so a DPI-enlarged window drifts off).
func recenter(hwnd uintptr) {
	var r struct{ left, top, right, bottom int32 }
	if ret, _, _ := procGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&r))); ret == 0 {
		return
	}
	w, h := r.right-r.left, r.bottom-r.top
	sw, _, _ := procGetSystemMetric.Call(0) // SM_CXSCREEN
	sh, _, _ := procGetSystemMetric.Call(1) // SM_CYSCREEN
	x := (int32(sw) - w) / 2
	y := (int32(sh) - h) / 2
	if x < 0 {
		x = 0
	}
	if y < 0 {
		y = 0
	}
	const swpNoSize, swpNoZOrder, swpNoActivate = 0x0001, 0x0004, 0x0010
	procSetWindowPos.Call(hwnd, 0, uintptr(x), uintptr(y), 0, 0, swpNoSize|swpNoZOrder|swpNoActivate)
}

// OnAction binds the page's window.ui.action(name, payload) calls. payload is
// raw JSON (null when the page passes nothing).
func (w *Window) OnAction(fn func(name string, payload json.RawMessage)) {
	_ = w.wv.Bind("goAction", func(name string, payload json.RawMessage) {
		fn(name, payload)
	})
}

// SetState pushes state to the page (window.__setState). Safe from any goroutine.
func (w *Window) SetState(v any) {
	js, err := json.Marshal(v)
	if err != nil {
		return
	}
	w.wv.Dispatch(func() { w.wv.Eval("window.__setState(" + string(js) + ")") })
}

// Eval runs JS on the UI thread. Safe from any goroutine.
func (w *Window) Eval(js string) { w.wv.Dispatch(func() { w.wv.Eval(js) }) }

// navigate loads another embedded page in this same window. Safe from any
// goroutine. The goAction bridge (an AddScriptToExecuteOnDocumentCreated
// script) is re-injected into every new document, so bindings survive.
func (w *Window) navigate(page string) {
	w.wv.Dispatch(func() { w.wv.Navigate(w.base + page) })
}

// Close ends Run. Safe from any goroutine, and idempotent.
//
// It posts WM_CLOSE to the native window rather than calling Terminate()
// (PostQuitMessage): that way the still-running message loop actually runs
// DestroyWindow -> WM_DESTROY, so the window and its class routing are torn
// down before Run returns. Terminate() left the native window alive, and its
// deferred WM_CLOSE would then be picked up by the *next* webview's message
// loop in the same process — closing that one on sight (the installer's
// second window flashing and the setup bailing out).
func (w *Window) Close() {
	w.mu.Lock()
	w.closed = true
	w.mu.Unlock()
	procPostMessageW.Call(uintptr(w.wv.Window()), wmClose, 0, 0)
}

// Run navigates to the initial page (if one was set — RunInstaller sets none
// and drives navigation itself), shows the window, and blocks until it is
// closed (by Close or the user clicking the window's X).
func (w *Window) Run() {
	if w.page != "" {
		w.wv.Navigate(w.base + w.page)
	}
	w.wv.Run()
}
