//go:build windows

// apply_windows.go is the Windows half of OTA update: download, verify,
// smoke-test, swap the running exe, and — on the next start — either confirm
// the new binary healthy or roll back to the old one.
//
// Swapping a running .exe: Windows won't let you overwrite or delete the
// image of a running process, but it will let you RENAME it. So the sequence
// is rename-aside then rename-into-place, never an in-place write. After a
// successful swap the caller exits cleanly and the Windows service's own
// recovery config restarts the (now new) binary.
package updater

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// ErrRolledBack is returned by ResolvePending when it has restored the
// previous binary and the caller must exit so the service manager starts it.
var ErrRolledBack = errors.New("update rolled back; restart into previous binary")

// SelfTestArg is the flag cmd/agent handles by printing its version and
// exiting 0. Apply runs the freshly downloaded binary with it before
// committing the swap, so an obviously broken build never lands.
const SelfTestArg = "-selftest"

// Apply downloads lv, verifies it against the pinned key + manifest sha256,
// smoke-tests it, and swaps it in for the running executable. On success the
// caller should stop the agent promptly so the service restarts into the new
// binary. currentVersion guards against downgrades.
func Apply(ctx context.Context, lv *LatestVersion, currentVersion, dataDir string) error {
	if lv == nil || lv.Version == "" || lv.BinaryURL == "" {
		return errors.New("update manifest is incomplete")
	}
	if !IsNewer(currentVersion, lv.Version) {
		return fmt.Errorf("refusing update: %s is not newer than running %s", lv.Version, currentVersion)
	}
	if lv.SHA256 == "" || lv.Signature == "" {
		return errors.New("refusing unsigned update: manifest has no sha256/signature")
	}

	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locating running executable: %w", err)
	}
	dir := filepath.Dir(exePath)
	newPath := filepath.Join(dir, "agent.new.exe")
	oldPath := filepath.Join(dir, "agent.old.exe")

	data, err := download(ctx, lv.BinaryURL)
	if err != nil {
		return err
	}
	if err := VerifyBinary(data, lv.SHA256, lv.Signature); err != nil {
		return err // ErrIntegrity — binary discarded, never written to disk
	}

	_ = os.Remove(newPath)
	if err := os.WriteFile(newPath, data, 0o755); err != nil {
		return fmt.Errorf("writing new binary: %w", err)
	}
	if err := smokeTest(ctx, newPath); err != nil {
		os.Remove(newPath)
		return fmt.Errorf("new binary failed smoke test: %w", err)
	}

	if err := saveState(dataDir, &updateState{
		Stage: stageStaged, From: currentVersion, To: lv.Version,
		OldExe: oldPath, StagedAt: time.Now(),
	}); err != nil {
		os.Remove(newPath)
		return fmt.Errorf("recording update state: %w", err)
	}

	_ = os.Remove(oldPath) // stale from a previous update
	if err := os.Rename(exePath, oldPath); err != nil {
		os.Remove(newPath)
		clearState(dataDir)
		return fmt.Errorf("moving current binary aside: %w", err)
	}
	if err := os.Rename(newPath, exePath); err != nil {
		_ = os.Rename(oldPath, exePath) // best-effort restore
		clearState(dataDir)
		return fmt.Errorf("installing new binary: %w", err)
	}

	st, _ := loadState(dataDir)
	if st != nil {
		st.Stage = stageSwapped
		_ = saveState(dataDir, st)
	}
	return nil
}

// ResolvePending is called once at startup. It advances the update state
// machine: marks a fresh swap as "probing", counts restarts while probing,
// rolls back a crash-looping or stalled new binary, and cleans up after a
// confirmed update or a completed rollback. Returns ErrRolledBack when it
// has restored the previous binary and the process must exit.
func ResolvePending(dataDir, currentVersion string, report func(event, detail string)) error {
	st, err := loadState(dataDir)
	if err != nil || st == nil {
		return nil
	}
	exePath, _ := os.Executable()
	dir := filepath.Dir(exePath)

	action, next := decideResolve(st, currentVersion, time.Now())
	switch action {
	case actionRollback:
		return rollback(dataDir, next, dir, exePath, next.FailReason, report)

	case actionReportRolledBack:
		if report != nil {
			report("agent_update_failed", fmt.Sprintf("%s -> %s: %s", next.From, next.To, next.FailReason))
		}
		_ = os.Remove(filepath.Join(dir, "agent.failed.exe"))
		clearState(dataDir)

	case actionCleanupConfirmed:
		_ = os.Remove(next.OldExe)
		clearState(dataDir)

	case actionNone:
		if next != nil {
			_ = saveState(dataDir, next)
		}
	}
	return nil
}

// ConfirmHealthy is called after the agent has had a successful exchange
// with the backend. If a new binary is being probed, it's now trusted:
// delete the old binary and report the successful update.
func ConfirmHealthy(dataDir, currentVersion string, report func(event, detail string)) {
	st, err := loadState(dataDir)
	if err != nil || st == nil {
		return
	}
	if (st.Stage == stageProbing || st.Stage == stageSwapped) && currentVersion == st.To {
		_ = os.Remove(st.OldExe)
		clearState(dataDir)
		if report != nil {
			report("agent_updated", fmt.Sprintf("%s -> %s", st.From, st.To))
		}
	}
}

func rollback(dataDir string, st *updateState, dir, exePath, reason string, report func(event, detail string)) error {
	// Keep the bad binary for diagnostics, restore the known-good one.
	_ = os.Rename(exePath, filepath.Join(dir, "agent.failed.exe"))
	if err := os.Rename(st.OldExe, exePath); err != nil {
		// Can't restore — leave state so the next start retries; the service
		// recovery loop keeps trying either binary.
		st.FailReason = reason + " (restore failed: " + err.Error() + ")"
		_ = saveState(dataDir, st)
		return fmt.Errorf("rollback could not restore previous binary: %w", err)
	}
	st.Stage = stageRolledBack
	st.FailReason = reason
	_ = saveState(dataDir, st)
	if report != nil {
		report("agent_update_failed", fmt.Sprintf("%s -> %s: %s", st.From, st.To, reason))
	}
	return ErrRolledBack
}

// downloadAttempts is how many times download() will try the GitHub asset
// before giving up. This machine's first real OTA attempt failed on a single
// mid-stream connection reset ("wsarecv: forcibly closed") and then didn't try
// again for 6 hours; a couple of quick retries ride out a flaky link.
const downloadAttempts = 3

// downloadBackoff is the base delay between download attempts (attempt N waits
// N * downloadBackoff). A var so tests can zero it.
var downloadBackoff = 4 * time.Second

func download(ctx context.Context, url string) ([]byte, error) {
	var lastErr error
	for i := 0; i < downloadAttempts; i++ {
		if i > 0 && downloadBackoff > 0 {
			t := time.NewTimer(time.Duration(i) * downloadBackoff)
			select {
			case <-ctx.Done():
				t.Stop()
				return nil, ctx.Err()
			case <-t.C:
			}
		}
		data, retryable, err := downloadOnce(ctx, url)
		if err == nil {
			return data, nil
		}
		lastErr = err
		if !retryable {
			break
		}
	}
	return nil, lastErr
}

// downloadOnce makes a single GET. retryable is true for transport errors, a
// mid-stream read failure, 5xx and 429 — the failures a retry can recover —
// and false for a 4xx, which means the manifest URL itself is wrong.
func downloadOnce(ctx context.Context, url string) (data []byte, retryable bool, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, false, err
	}
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return nil, true, fmt.Errorf("downloading update: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		retry := resp.StatusCode >= 500 || resp.StatusCode == http.StatusTooManyRequests
		return nil, retry, fmt.Errorf("update download rejected: %s", resp.Status)
	}
	// 128 MB ceiling — an agent build is ~20 MB; anything near this is wrong.
	body, err := io.ReadAll(io.LimitReader(resp.Body, 128<<20))
	if err != nil {
		return nil, true, fmt.Errorf("reading update body: %w", err)
	}
	return body, false, nil
}

func smokeTest(ctx context.Context, path string) error {
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, path, SelfTestArg).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%w (output: %s)", err, string(out))
	}
	return nil
}
