//go:build windows

package ui

import (
	"bytes"
	"context"
	"fmt"
	"image/png"
	"syscall"
	"time"

	"github.com/lxn/walk"
	"github.com/lxn/win"
	qrcode "github.com/skip2/go-qrcode"
)

// ShowEnrollment presents the pairing code and QR in a visible user-session
// window, then waits for the parent app to complete pairing.
func ShowEnrollment(ctx context.Context, code, qrPayload string, expiresAt time.Time, wait func(context.Context) error, onLinked func(func(string)) error) error {
	pngBytes, err := qrcode.Encode(qrPayload, qrcode.Medium, 240)
	if err != nil {
		return fmt.Errorf("creating QR code: %w", err)
	}
	img, err := png.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		return fmt.Errorf("reading QR code: %w", err)
	}
	bmp, err := walk.NewBitmapFromImage(img)
	if err != nil {
		return err
	}
	defer bmp.Dispose()

	// A MainWindow eagerly creates toolbar/statusbar tooltip controls. On some
	// Windows builds that initialization fails with TTM_ADDTOOL, even though
	// the enrollment UI does not need either control. A fixed-size dialog keeps
	// the same visible flow without those extra controls.
	mw, err := walk.NewDialogWithFixedSize(nil)
	if err != nil {
		return showEnrollmentFallback(ctx, code, qrPayload, expiresAt, wait, onLinked)
	}
	mw.SetTitle("ChaqimchiAI Guard — Qurilmani bog‘lash")
	mw.SetSize(walk.Size{Width: 520, Height: 520})
	box := walk.NewVBoxLayout()
	box.SetMargins(walk.Margins{HNear: 28, VNear: 24, HFar: 28, VFar: 24})
	box.SetSpacing(12)
	mw.SetLayout(box)
	var controlErr error
	add := func(text string) *walk.Label {
		l, createErr := walk.NewLabel(mw)
		if createErr != nil {
			controlErr = createErr
			return nil
		}
		l.SetText(text)
		return l
	}
	add("Qurilmani ota-ona ilovasiga ulang")
	add("Ota-ona ilovasida QR kodni skaner qiling yoki quyidagi kodni kiriting.")
	iv, err := walk.NewImageView(mw)
	if err != nil {
		mw.Dispose()
		return showEnrollmentFallback(ctx, code, qrPayload, expiresAt, wait, onLinked)
	}
	iv.SetImage(bmp)
	iv.SetMinMaxSize(walk.Size{Width: 240, Height: 240}, walk.Size{Width: 240, Height: 240})
	codeLabel := add("Bog‘lash kodi: " + code)
	status := add("")
	if controlErr != nil {
		mw.Dispose()
		return showEnrollmentFallback(ctx, code, qrPayload, expiresAt, wait, onLinked)
	}
	progress, err := walk.NewProgressBar(mw)
	if err != nil {
		mw.Dispose()
		return showEnrollmentFallback(ctx, code, qrPayload, expiresAt, wait, onLinked)
	}
	if err := progress.SetMarqueeMode(true); err != nil {
		mw.Dispose()
		return showEnrollmentFallback(ctx, code, qrPayload, expiresAt, wait, onLinked)
	}
	font, _ := walk.NewFont("Segoe UI", 18, walk.FontBold)
	codeLabel.SetFont(font)
	cancel, err := walk.NewPushButton(mw)
	if err != nil || controlErr != nil {
		mw.Dispose()
		return showEnrollmentFallback(ctx, code, qrPayload, expiresAt, wait, onLinked)
	}
	cancel.SetText("Bekor qilish")
	ctx, stop := context.WithCancel(ctx)
	defer stop()
	cancel.Clicked().Attach(func() { stop(); mw.Close(walk.DlgCmdCancel) })
	completed := make(chan struct{})
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			remaining := time.Until(expiresAt)
			if remaining <= 0 {
				mw.Synchronize(func() {
					status.SetText("Kod muddati tugadi. Yangi kod olinmoqda...")
					time.AfterFunc(1200*time.Millisecond, func() { mw.Synchronize(func() { mw.Close(walk.DlgCmdCancel) }) })
				})
				stop()
				return
			}
			minutes := int(remaining / time.Minute)
			seconds := int(remaining/time.Second) % 60
			mw.Synchronize(func() { status.SetText(fmt.Sprintf("Bog‘lanish kutilmoqda — %02d:%02d qoldi", minutes, seconds)) })
			select {
			case <-ctx.Done():
				return
			case <-completed:
				return
			case <-ticker.C:
			}
		}
	}()
	go func() {
		err := wait(ctx)
		mw.Synchronize(func() {
			if err == nil {
				close(completed)
				mw.Synchronize(func() { status.SetText("✓ Qurilma bog‘landi. Xizmat sozlanmoqda...") })
				go func() {
					installErr := onLinked(func(message string) {
						mw.Synchronize(func() { status.SetText(message) })
					})
					mw.Synchronize(func() {
						if installErr != nil {
							_ = progress.SetMarqueeMode(false)
							status.SetText("O‘rnatishda xatolik: " + installErr.Error())
							return
						}
						_ = progress.SetMarqueeMode(false)
						status.SetText("✓ Tayyor. ChaqimchiAI Guard ishlamoqda.")
						time.AfterFunc(1500*time.Millisecond, func() { mw.Synchronize(func() { mw.Close(walk.DlgCmdOK) }) })
					})
				}()
			} else if ctx.Err() == nil {
				status.SetText("Bog‘lanishda xatolik: " + err.Error())
			}
		})
	}()
	mw.Run()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	return nil
}

// showEnrollmentFallback keeps pairing usable when the optional Walk window
// cannot initialize a Windows tooltip control (TTM_ADDTOOL). Manual code
// pairing does not depend on that control and is sufficient for the MVP.
func showEnrollmentFallback(ctx context.Context, code, qrPayload string, expiresAt time.Time, wait func(context.Context) error, onLinked func(func(string)) error) error {
	waitResult := make(chan error, 1)
	go func() { waitResult <- wait(ctx) }()

	title := "ChaqimchiAI Guard — Qurilmani bog‘lash"
	message := fmt.Sprintf(
		"QR oynasini ochib bo‘lmadi, lekin pairing davom etmoqda.\n\n"+
			"Parent ilovasida 6 xonali kodni qo‘lda kiriting:\n\n%s\n\n"+
			"QR payload: %s\n\nKod %s gacha amal qiladi.",
		code,
		qrPayload,
		expiresAt.Local().Format("15:04:05"),
	)
	messageDone := make(chan struct{})
	go func() {
		walk.MsgBox(nil, title, message, walk.MsgBoxOK|walk.MsgBoxIconInformation|walk.MsgBoxTopMost)
		close(messageDone)
	}()

	closeMessageBox := func() {
		caption := syscall.StringToUTF16Ptr(title)
		for attempt := 0; attempt < 20; attempt++ {
			hwnd := win.FindWindow(nil, caption)
			if hwnd != 0 {
				win.PostMessage(hwnd, win.WM_CLOSE, 0, 0)
				return
			}
			time.Sleep(50 * time.Millisecond)
		}
	}

	select {
	case err := <-waitResult:
		closeMessageBox()
		<-messageDone
		if err == nil {
			if installErr := onLinked(func(string) {}); installErr != nil {
				return installErr
			}
		}
		return err
	case <-ctx.Done():
		closeMessageBox()
		<-messageDone
		return ctx.Err()
	}
}
