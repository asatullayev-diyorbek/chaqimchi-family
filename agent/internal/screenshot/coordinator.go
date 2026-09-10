package screenshot

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
)

// Coordinator owns the service-side capture workflow: it polls the backend
// for queued requests, obtains a presigned upload URL, and either
//
//   - hands the job to the user-session helper via localipc (Session 0
//     service — it can't see the screen), then confirms when the helper
//     reports back, or
//   - captures and uploads in-process when Local is true (interactive/dev
//     runs, where there is no helper).
type Coordinator struct {
	client *Client
	// Local runs capture in this process instead of delegating to the
	// session helper. Set for interactive mode.
	Local bool

	// PollInterval is the idle cadence; ActivePollInterval is used while a
	// job is outstanding so the parent sees the image quickly.
	PollInterval       time.Duration
	ActivePollInterval time.Duration
	// HelperTimeout: if the helper hasn't reported a handed-out job within
	// this long, give up and mark it failed (helper crashed / no session).
	HelperTimeout time.Duration

	// OnCaptured, if set, is called after a screenshot is successfully
	// uploaded — the service uses it to surface a child-facing notice.
	OnCaptured func(time.Time)

	mu        sync.Mutex
	active    *localipc.ScreenshotJob
	handedAt  time.Time
	inFlight  bool // a job is being processed (poll faster)
}

func NewCoordinator(c *Client) *Coordinator {
	return &Coordinator{
		client:             c,
		PollInterval:       20 * time.Second,
		ActivePollInterval: 8 * time.Second,
		HelperTimeout:      90 * time.Second,
	}
}

// Job is the localipc screenshotJob hook: the next capture for the helper,
// or nil. Never returns a job in Local mode.
func (co *Coordinator) Job() *localipc.ScreenshotJob {
	if co.Local {
		return nil
	}
	co.mu.Lock()
	defer co.mu.Unlock()
	return co.active
}

// SubmitResult is the localipc screenshotDone hook: the helper's outcome for
// a handed-out job.
func (co *Coordinator) SubmitResult(res localipc.ScreenshotResult) {
	co.mu.Lock()
	active := co.active
	co.mu.Unlock()
	if active == nil || res.ID != active.ID {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	var err error
	if res.OK {
		err = co.client.Confirm(ctx, res.ID, Meta{
			CapturedAt: time.Now().UTC(),
			Width:      res.Width,
			Height:     res.Height,
			SizeBytes:  res.SizeBytes,
			SHA256:     res.SHA256,
		})
	} else {
		reason := res.Error
		if reason == "" {
			reason = "capture failed in session"
		}
		err = co.client.Failed(ctx, res.ID, reason)
	}
	if err != nil {
		log.Printf("screenshot %s: reporting result: %v", res.ID, err)
	} else if res.OK && co.OnCaptured != nil {
		co.OnCaptured(time.Now())
	}

	co.mu.Lock()
	co.active = nil
	co.inFlight = false
	co.mu.Unlock()
}

// Run loops until ctx is cancelled.
func (co *Coordinator) Run(ctx context.Context) {
	for {
		co.tick(ctx)

		co.mu.Lock()
		wait := co.PollInterval
		if co.inFlight {
			wait = co.ActivePollInterval
		}
		co.mu.Unlock()

		t := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			t.Stop()
			return
		case <-t.C:
		}
	}
}

func (co *Coordinator) tick(ctx context.Context) {
	co.mu.Lock()
	active := co.active
	handedAt := co.handedAt
	co.mu.Unlock()

	// A job the helper never picked up / never answered.
	if active != nil {
		if !co.Local && time.Since(handedAt) > co.HelperTimeout {
			fctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			_ = co.client.Failed(fctx, active.ID, "no interactive session responded")
			cancel()
			co.mu.Lock()
			co.active, co.inFlight = nil, false
			co.mu.Unlock()
		}
		return // one at a time
	}

	pending, err := co.client.PollPending(ctx)
	if err != nil {
		log.Printf("screenshot poll: %v", err)
		return
	}
	if len(pending) == 0 {
		return
	}
	req := pending[0]

	target, err := co.client.RequestUploadURL(ctx, req.ID)
	if err != nil {
		log.Printf("screenshot %s: upload URL: %v", req.ID, err)
		return
	}

	co.mu.Lock()
	co.active = &localipc.ScreenshotJob{ID: req.ID, UploadURL: target.UploadURL}
	co.handedAt = time.Now()
	co.inFlight = true
	job := co.active
	co.mu.Unlock()

	if co.Local {
		go co.captureLocally(ctx, *job)
	}
}

// captureLocally is the interactive-mode path: grab, upload, confirm here.
func (co *Coordinator) captureLocally(ctx context.Context, job localipc.ScreenshotJob) {
	res := CaptureAndUpload(ctx, job.UploadURL)
	res.ID = job.ID
	co.SubmitResult(res)
}

// CaptureAndUpload performs one capture and PUT to R2. Shared by the
// interactive path and the session helper (cmd/agent -foreground-reporter).
func CaptureAndUpload(ctx context.Context, uploadURL string) localipc.ScreenshotResult {
	jpeg, w, h, err := Capture()
	if err != nil {
		return localipc.ScreenshotResult{OK: false, Error: truncate(err.Error(), 280)}
	}
	if err := PutToR2(ctx, uploadURL, jpeg); err != nil {
		return localipc.ScreenshotResult{OK: false, Error: truncate("upload: "+err.Error(), 280)}
	}
	return localipc.ScreenshotResult{
		OK:        true,
		Width:     w,
		Height:    h,
		SizeBytes: len(jpeg),
		SHA256:    sha256hex(jpeg),
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
