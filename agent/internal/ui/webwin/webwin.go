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
	"sync"

	"github.com/chaqimchi/chaqimchi-family/agent/webui"
	webview "github.com/jchv/go-webview2"
)

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

// Window is one open app window.
type Window struct {
	wv     webview.WebView
	mu     sync.Mutex
	closed bool
}

// New creates the window and navigates it to opts.Page. Register handlers
// with OnAction, then call Run. Returns an error if the WebView2 runtime is
// missing or the window can't be created — callers fall back to walk.
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
	wv.SetSize(opts.Width, opts.Height, webview.HintFixed)
	wv.Navigate(base + opts.Page)
	return &Window{wv: wv}, nil
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

// Close ends Run. Safe from any goroutine, and idempotent.
func (w *Window) Close() {
	w.mu.Lock()
	w.closed = true
	w.mu.Unlock()
	w.wv.Terminate()
}

// Run shows the window and blocks until it is closed (by Close or the user
// clicking the window's X). Destroys the webview before returning.
func (w *Window) Run() {
	w.wv.Run()
	w.wv.Destroy()
}
