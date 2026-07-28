//go:build windows

package updater

// This file is the Windows-specific half of the updater: downloading the
// new binary and swapping it into place. Cross-compiled for windows/amd64
// and type-checks, but never run on a real Windows machine — the rename
// sequence below is the textbook pattern for self-updating a running .exe
// (Windows generally allows renaming a file whose image is memory-mapped
// by a running process, just not overwriting/deleting it in place), but
// "textbook" and "verified on this codebase" are not the same claim.
//
// This does NOT restart the Windows service itself — see the Update()
// doc comment for why, and what's assumed instead.

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// downloadTo streams url to destPath, writing to a temp file first so a
// failed/partial download never leaves a corrupt file at destPath.
func downloadTo(ctx context.Context, client *http.Client, url, destPath string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("downloading update: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server rejected binary download: %s", resp.Status)
	}

	tmp := destPath + ".download"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(tmp)
		return fmt.Errorf("writing downloaded binary: %w", err)
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, destPath)
}

// Update downloads binaryURL and swaps it in for the currently running
// executable, using the rename-aside/rename-into-place pattern (never an
// in-place overwrite, which Windows would reject for a running .exe):
//
//  1. download to <dir>/agent.new.exe
//  2. rename the running exe to <dir>/agent.old.exe
//  3. rename agent.new.exe to the running exe's original path
//
// It does NOT restart the service or the process — that's left to the
// caller (see cmd/agent/main.go), which is expected to exit cleanly right
// after a successful Update() and rely on the Windows service's own
// recovery/restart-on-exit configuration (set via `sc.exe failure` at
// install time — there is no installer in this repo yet that configures
// this) to bring the new binary up. That's an explicit assumption, not
// something this function verifies.
func Update(ctx context.Context, httpClient *http.Client, binaryURL string) error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locating running executable: %w", err)
	}
	dir := filepath.Dir(exePath)
	newPath := filepath.Join(dir, "agent.new.exe")
	oldPath := filepath.Join(dir, "agent.old.exe")

	if httpClient == nil {
		httpClient = &http.Client{Timeout: 5 * time.Minute}
	}

	if err := downloadTo(ctx, httpClient, binaryURL, newPath); err != nil {
		return err
	}

	// Best-effort cleanup of a stale .old from a previous update — ignore
	// errors, it may not exist.
	os.Remove(oldPath)

	if err := os.Rename(exePath, oldPath); err != nil {
		os.Remove(newPath)
		return fmt.Errorf("moving current binary aside: %w", err)
	}
	if err := os.Rename(newPath, exePath); err != nil {
		// Best-effort restore so a failed update doesn't leave the agent
		// unable to start at all.
		os.Rename(oldPath, exePath)
		return fmt.Errorf("installing new binary: %w", err)
	}

	return nil
}
