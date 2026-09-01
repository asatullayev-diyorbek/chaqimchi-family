package localipc

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestStatusIsDisplayOnly(t *testing.T) {
	s := Status{Service: "running", Version: "1.0.0", StartedAt: "2026-08-03T00:00:00Z"}
	if s.Service != "running" || s.Version == "" || s.StartedAt == "" {
		t.Fatal("status must contain display fields")
	}
}

func testServer(t *testing.T, foreground chan<- string) *httptest.Server {
	t.Helper()
	return testServerWithIcons(t, foreground, nil)
}

func testServerWithIcons(t *testing.T, foreground chan<- string, icons chan<- AppIconReport) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(Handler(func() Status { return Status{Service: "running"} }, foreground, icons, nil))
	t.Cleanup(srv.Close)
	return srv
}

func TestAppIconRidesForegroundReport(t *testing.T) {
	fg := make(chan string, 1)
	icons := make(chan AppIconReport, 1)
	srv := testServerWithIcons(t, fg, icons)

	body := `{"app":"chrome.exe","icon_app_id":"chrome.exe","icon_sha256":"abc","icon_png_b64":"iVBOR"}`
	resp, err := http.Post(srv.URL+"/v1/foreground", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", resp.StatusCode)
	}
	select {
	case got := <-icons:
		if got.AppID != "chrome.exe" || got.SHA256 != "abc" || got.PNGB64 != "iVBOR" {
			t.Fatalf("unexpected icon report: %+v", got)
		}
	case <-time.After(time.Second):
		t.Fatal("icon report never reached the channel")
	}
}

func TestForegroundReportWithoutIconLeavesIconChannelEmpty(t *testing.T) {
	fg := make(chan string, 1)
	icons := make(chan AppIconReport, 1)
	srv := testServerWithIcons(t, fg, icons)

	resp, err := http.Post(srv.URL+"/v1/foreground", "application/json", strings.NewReader(`{"app":"chrome.exe"}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	resp.Body.Close()
	select {
	case got := <-icons:
		t.Fatalf("did not expect an icon report, got %+v", got)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestForegroundReportReachesChannel(t *testing.T) {
	ch := make(chan string, 1)
	srv := testServer(t, ch)

	resp, err := http.Post(srv.URL+"/v1/foreground", "application/json", strings.NewReader(`{"app":"chrome.exe"}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("want 204, got %d", resp.StatusCode)
	}
	select {
	case got := <-ch:
		if got != "chrome.exe" {
			t.Fatalf("want chrome.exe, got %q", got)
		}
	case <-time.After(time.Second):
		t.Fatal("report never reached the channel")
	}
}

func TestForegroundReportDisabledWhenChannelNil(t *testing.T) {
	srv := testServer(t, nil)
	resp, err := http.Post(srv.URL+"/v1/foreground", "application/json", strings.NewReader(`{"app":"x"}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("want 404 when foreground reporting is disabled, got %d", resp.StatusCode)
	}
}

func TestForegroundReportNeverBlocks(t *testing.T) {
	ch := make(chan string) // unbuffered, nothing reading
	srv := testServer(t, ch)
	done := make(chan struct{})
	go func() {
		for i := 0; i < 5; i++ {
			resp, err := http.Post(srv.URL+"/v1/foreground", "application/json", strings.NewReader(`{"app":"a"}`))
			if err == nil {
				resp.Body.Close()
			}
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("a full channel blocked the reporter endpoint")
	}
}

func TestStatusRouteRejectsNonGet(t *testing.T) {
	srv := testServer(t, nil)
	resp, err := http.Post(srv.URL+"/v1/status", "application/json", nil)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("want 405, got %d", resp.StatusCode)
	}
}
