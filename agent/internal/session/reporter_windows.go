//go:build windows

// Package session bridges the Session 0 isolation gap. A Windows service
// runs in session 0, which has no interactive desktop, so
// tracker.ForegroundProcessName always returns "" there. RunReporter keeps a
// copy of the agent binary running in the active console session (relaunched
// on exit or session switch) with -foreground-reporter, which polls the real
// foreground window and streams it back to the service over local IPC.
package session

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const stillActive = 259 // STILL_ACTIVE

// RunReporter supervises a -foreground-reporter child in whatever session is
// currently the active console session. It returns only when ctx is
// cancelled; every failure is logged and retried so it can never take the
// service down.
func RunReporter(ctx context.Context, exePath string) {
	const retryDelay = 15 * time.Second
	for {
		if ctx.Err() != nil {
			return
		}
		session := windows.WTSGetActiveConsoleSessionId()
		if session == 0xFFFFFFFF {
			// No one is at the console (pre-logon / disconnected).
			sleep(ctx, retryDelay)
			continue
		}
		if err := runOnce(ctx, exePath, session); err != nil {
			log.Printf("session reporter (session %d): %v", session, err)
			sleep(ctx, retryDelay)
		}
	}
}

// runOnce launches one child in session and blocks until it exits, ctx is
// cancelled, or the active console session changes underneath it.
func runOnce(ctx context.Context, exePath string, session uint32) error {
	var userToken windows.Token
	if err := windows.WTSQueryUserToken(session, &userToken); err != nil {
		return err // usually "no user is logged on" — caller retries
	}
	defer userToken.Close()

	// After an SCM crash-restart the previous service instance's reporter is
	// orphaned in the user session and keeps POSTing to the new instance's
	// (working) IPC endpoint, so its own failure backstop never trips. Clear
	// any stray chaqimchi-agent.exe before spawning this instance's reporter.
	killStrayReporters()

	cmdLine, err := windows.UTF16PtrFromString(
		`"` + exePath + `" -foreground-reporter -parent-pid ` + strconv.Itoa(os.Getpid()),
	)
	if err != nil {
		return err
	}
	// winsta0\default is the interactive desktop; without naming it the
	// child would land on session 0's invisible station and see nothing.
	desktop, err := windows.UTF16PtrFromString(`winsta0\default`)
	if err != nil {
		return err
	}

	var si windows.StartupInfo
	si.Cb = uint32(unsafe.Sizeof(si))
	si.Desktop = desktop
	var pi windows.ProcessInformation

	err = windows.CreateProcessAsUser(
		userToken,
		nil,
		cmdLine,
		nil,
		nil,
		false,
		windows.CREATE_NO_WINDOW,
		nil, // inherit the service's environment; the child only needs loopback HTTP
		nil,
		&si,
		&pi,
	)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(pi.Thread)
	defer windows.CloseHandle(pi.Process)

	// Poll for child exit or a console-session switch; on either, return so
	// RunReporter starts a fresh child for the new state.
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			_ = windows.TerminateProcess(pi.Process, 0)
			return nil
		case <-ticker.C:
			if windows.WTSGetActiveConsoleSessionId() != session {
				_ = windows.TerminateProcess(pi.Process, 0)
				return nil
			}
			var code uint32
			if err := windows.GetExitCodeProcess(pi.Process, &code); err != nil {
				return err
			}
			if code != stillActive {
				return nil
			}
		}
	}
}

func sleep(ctx context.Context, d time.Duration) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}

// killStrayReporters terminates every other chaqimchi-agent.exe process. In a
// healthy state the only one besides this service is its own reporter child,
// which hasn't been spawned yet when this runs; the target is an orphan
// reporter left by a previous, crashed service instance. Running as SYSTEM,
// the service can terminate the user-session reporter.
func killStrayReporters() {
	self := uint32(os.Getpid())
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return
	}
	defer windows.CloseHandle(snap)

	var entry windows.ProcessEntry32
	entry.Size = uint32(unsafe.Sizeof(entry))
	if err := windows.Process32First(snap, &entry); err != nil {
		return
	}
	for {
		if entry.ProcessID != self &&
			windows.UTF16ToString(entry.ExeFile[:]) == "chaqimchi-agent.exe" {
			if h, err := windows.OpenProcess(windows.PROCESS_TERMINATE, false, entry.ProcessID); err == nil {
				_ = windows.TerminateProcess(h, 0)
				windows.CloseHandle(h)
			}
		}
		if err := windows.Process32Next(snap, &entry); err != nil {
			return
		}
	}
}
