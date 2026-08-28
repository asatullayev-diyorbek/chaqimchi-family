//go:build windows

package ui

import (
	"context"
	"fmt"
	"syscall"
	"time"

	"github.com/lxn/walk"
	d "github.com/lxn/walk/declarative"
	"github.com/lxn/win"
	qrcode "github.com/skip2/go-qrcode"
)

// ShowEnrollment presents the pairing code and QR in a visible user-session
// window, then waits for the parent app to complete pairing. wait's second
// argument is called on every failed poll (e.g. no internet) so the window
// can tell the user why nothing is happening instead of just counting down.
// onLinked runs the actual service install once the parent has linked the
// device; its callback updates the visible status line.
func ShowEnrollment(ctx context.Context, code, qrPayload string, expiresAt time.Time, wait func(context.Context, func(error)) error, onLinked func(func(string)) error) error {
	// qrDIP is the on-screen box; the source bitmap is rendered larger so it
	// stays crisp after walk scales it for the monitor's DPI.
	const qrDIP = 176
	qr, err := qrcode.New(qrPayload, qrcode.Medium)
	if err != nil {
		return showEnrollmentFallback(ctx, code, qrPayload, expiresAt, wait, onLinked)
	}
	qr.DisableBorder = false
	bmp, err := walk.NewBitmapFromImage(qr.Image(qrDIP * 3))
	if err != nil {
		return showEnrollmentFallback(ctx, code, qrPayload, expiresAt, wait, onLinked)
	}
	defer bmp.Dispose()

	ctx, stop := context.WithCancel(ctx)
	defer stop()

	var (
		dlg       *walk.Dialog
		statusLbl *walk.Label
		bar       *walk.ProgressBar
		cancelBtn *walk.PushButton
	)
	completed := make(chan struct{})

	err = d.Dialog{
		AssignTo:   &dlg,
		Title:      "ChaqimchiAI Guard — Qurilmani bog‘lash",
		Icon:       brandIcon(),
		Background: solid(colorCanvas),
		FixedSize:  true,
		Size:       d.Size{Width: 432, Height: 524},
		Layout:     d.VBox{Margins: d.Margins{Left: 26, Top: 20, Right: 26, Bottom: 16}, Spacing: 8},
		Children: []d.Widget{
			brandRow(),
			hairline(),
			d.Label{Text: "OILAGA  BOG‘LASH", Font: fontOf(8, true), TextColor: colorAccent},
			d.Label{Text: "Qurilmani hisobingizga bog‘lang", Font: fontOf(14, true), TextColor: colorInk},
			d.TextLabel{
				Text: "Ota-ona telefonidagi ChaqimchiAI Family ilovasida “Qurilma qo‘shish”ni oching va QR kodni skaner qiling — yoki 6 xonali kodni kiriting.",
				Font: fontOf(9, false), TextColor: colorMuted, MinSize: d.Size{Width: 372},
			},
			d.Composite{
				Background: solid(colorCard),
				Border:     true,
				MinSize:    d.Size{Height: qrDIP + 26},
				MaxSize:    d.Size{Height: qrDIP + 26},
				Layout:     d.HBox{Margins: d.Margins{Left: 13, Top: 13, Right: 13, Bottom: 13}},
				Children: []d.Widget{
					d.HSpacer{},
					d.ImageView{Image: bmp, Mode: d.ImageViewModeZoom, MinSize: d.Size{Width: qrDIP, Height: qrDIP}, MaxSize: d.Size{Width: qrDIP, Height: qrDIP}},
					d.HSpacer{},
				},
			},
			d.Label{Text: spacedCode(code), Font: fontOf(21, true), TextColor: colorInk, Alignment: d.AlignHCenterVNear},
			d.Label{AssignTo: &statusLbl, Font: fontOf(9, false), TextColor: colorMuted, Alignment: d.AlignHCenterVNear},
			d.ProgressBar{AssignTo: &bar, MarqueeMode: true, MinSize: d.Size{Height: 4}, MaxSize: d.Size{Height: 4}},
			d.VSpacer{},
			d.Composite{
				Layout: d.HBox{MarginsZero: true},
				Children: []d.Widget{
					d.PushButton{AssignTo: &cancelBtn, Text: "Bekor qilish", MinSize: d.Size{Width: 104, Height: 28}, OnClicked: func() { stop(); dlg.Cancel() }},
					d.HSpacer{},
				},
			},
		},
	}.Create(nil)
	if err != nil {
		return showEnrollmentFallback(ctx, code, qrPayload, expiresAt, wait, onLinked)
	}
	dlg.SetCancelButton(cancelBtn)

	setStatus := func(s string, c walk.Color) {
		dlg.Synchronize(func() {
			statusLbl.SetTextColor(c)
			statusLbl.SetText(s)
		})
	}

	// Countdown + connectivity state.
	var connProblem bool
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			remaining := time.Until(expiresAt)
			if remaining <= 0 {
				setStatus("Kod muddati tugadi — yangi kod olinmoqda...", colorMuted)
				time.AfterFunc(1200*time.Millisecond, func() { dlg.Synchronize(func() { dlg.Cancel() }) })
				stop()
				return
			}
			mm, ss := int(remaining/time.Minute), int(remaining/time.Second)%60
			text := fmt.Sprintf("Bog‘lanish kutilmoqda — %02d:%02d qoldi", mm, ss)
			if connProblem {
				text = fmt.Sprintf("Internetga ulanib bo‘lmayapti, qayta urinilmoqda... (%02d:%02d)", mm, ss)
			}
			setStatus(text, colorMuted)
			select {
			case <-ctx.Done():
				return
			case <-completed:
				return
			case <-ticker.C:
			}
		}
	}()

	// Wait for the parent link, then run the install.
	go func() {
		waitErr := wait(ctx, func(error) { connProblem = true })
		dlg.Synchronize(func() {
			if waitErr != nil {
				if ctx.Err() == nil {
					setStatus("Bog‘lanishda xatolik: "+waitErr.Error(), colorDanger)
				}
				return
			}
			close(completed)
			setStatus("✓ Qurilma bog‘landi. Xizmat sozlanmoqda...", colorOK)
			go func() {
				installErr := onLinked(func(msg string) { setStatus(msg, colorMuted) })
				dlg.Synchronize(func() {
					_ = bar.SetMarqueeMode(false)
					if installErr != nil {
						setStatus("O‘rnatishda xatolik: "+installErr.Error(), colorDanger)
						return
					}
					setStatus("✓ Tayyor. ChaqimchiAI Guard ishlamoqda.", colorOK)
					time.AfterFunc(1600*time.Millisecond, func() { dlg.Synchronize(func() { dlg.Accept() }) })
				})
			}()
		})
	}()

	dlg.Run()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	return nil
}

// spacedCode turns "482913" into "482 913" so it reads and dictates cleanly.
func spacedCode(code string) string {
	if len(code) == 6 {
		return code[:3] + " " + code[3:]
	}
	return code
}

// showEnrollmentFallback keeps pairing usable if the Walk window can't be
// created at all (missing ComCtl32, locked-down session). Manual code entry
// still works; it just isn't pretty.
func showEnrollmentFallback(ctx context.Context, code, qrPayload string, expiresAt time.Time, wait func(context.Context, func(error)) error, onLinked func(func(string)) error) error {
	waitResult := make(chan error, 1)
	go func() {
		waitResult <- wait(ctx, func(error) {})
	}()

	title := "ChaqimchiAI Guard — Qurilmani bog‘lash"
	message := fmt.Sprintf(
		"Ota-ona ilovasida quyidagi 6 xonali kodni kiriting:\n\n        %s\n\n"+
			"Kod %s gacha amal qiladi. Bu oynani ochiq qoldiring.",
		spacedCode(code), expiresAt.Local().Format("15:04"),
	)
	messageDone := make(chan struct{})
	go func() {
		walk.MsgBox(nil, title, message, walk.MsgBoxOK|walk.MsgBoxIconInformation|walk.MsgBoxTopMost)
		close(messageDone)
	}()

	// The MsgBox is modal, so once pairing finishes elsewhere we have to
	// close it by handle to let the flow continue.
	closeBox := func() {
		caption := syscall.StringToUTF16Ptr(title)
		for attempt := 0; attempt < 20; attempt++ {
			if hwnd := win.FindWindow(nil, caption); hwnd != 0 {
				win.PostMessage(hwnd, win.WM_CLOSE, 0, 0)
				return
			}
			time.Sleep(50 * time.Millisecond)
		}
	}

	select {
	case err := <-waitResult:
		closeBox()
		<-messageDone
		if err == nil {
			if installErr := onLinked(func(string) {}); installErr != nil {
				return installErr
			}
		}
		return err
	case <-ctx.Done():
		closeBox()
		<-messageDone
		return ctx.Err()
	}
}
