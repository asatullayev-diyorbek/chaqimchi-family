//go:build windows

package ui

import (
	"github.com/lxn/walk"
	d "github.com/lxn/walk/declarative"
)

// RequireInstallerConsent presents the non-skippable transparency notice
// before enrollment credentials are created (installer design §3.2). It
// returns true only if the operator ticks the acknowledgement box and
// chooses "Davom etish"; any other exit (cancel, close, checkbox left
// unticked) returns false and the install must stop.
func RequireInstallerConsent() (bool, error) {
	var (
		dlg        *walk.Dialog
		ackBox     *walk.CheckBox
		continueBt *walk.PushButton
		accepted   bool
	)

	err := d.Dialog{
		AssignTo:   &dlg,
		Title:      "ChaqimchiAI Guard — Shaffoflik va rozilik",
		Icon:       brandIcon(),
		Background: solid(colorCanvas),
		FixedSize:  true,
		Size:       d.Size{Width: 468, Height: 476},
		Layout:     d.VBox{Margins: d.Margins{Left: 26, Top: 20, Right: 26, Bottom: 16}, Spacing: 8},
		Children: []d.Widget{
			brandRow(),
			hairline(),
			d.Label{Text: "SHAFFOFLIK  VA  ROZILIK", Font: fontOf(8, true), TextColor: colorAccent},
			d.Label{Text: "Nimani ko‘ramiz, nimani ko‘rmaymiz", Font: fontOf(14, true), TextColor: colorInk},
			d.TextLabel{
				Text: "ChaqimchiAI Family yashirin kuzatuv vositasi emas. Bu qadamni o‘tkazib bo‘lmaydi — barcha ma’lumot ota-ona va bola uchun ochiq.",
				Font: fontOf(9, false), TextColor: colorMuted, MinSize: d.Size{Width: 410},
			},
			d.VSpacer{Size: 2},
			seenRow(true, "Ilova va sayt nomlari", "To‘liq sahifa manzillari emas"),
			seenRow(true, "Ekran oldidagi vaqt", "Kunlik jami va ilovalar bo‘yicha"),
			seenRow(true, "Qurilma holati", "Onlayn/oflayn, batareya"),
			d.VSpacer{Size: 2},
			seenRow(false, "Xabarlar, chatlar va parollar", "Hech qachon o‘qilmaydi"),
			seenRow(false, "Kamera, mikrofon, bosilgan tugmalar", "Hech qachon yozilmaydi"),
			d.VSpacer{},
			d.CheckBox{
				AssignTo: &ackBox,
				Text:     "  O‘qidim va bu ma’lumotlar qanday ishlatilishini tushundim.",
				Font:     fontOf(9, false),
				OnCheckedChanged: func() {
					continueBt.SetEnabled(ackBox.Checked())
				},
			},
			hairline(),
			d.Composite{
				Layout: d.HBox{MarginsZero: true, Spacing: 8},
				Children: []d.Widget{
					d.PushButton{Text: "Bekor qilish", MinSize: d.Size{Width: 104, Height: 28}, OnClicked: func() { dlg.Cancel() }},
					d.HSpacer{},
					d.PushButton{
						AssignTo:  &continueBt,
						Text:      "Davom etish",
						Enabled:   false,
						MinSize:   d.Size{Width: 116, Height: 28},
						OnClicked: func() { accepted = true; dlg.Accept() },
					},
				},
			},
		},
	}.Create(nil)
	if err != nil {
		// Fall back to the old modal notice if the window can't be built.
		return requireInstallerConsentFallback()
	}
	dlg.Run()
	return accepted, nil
}

// seenRow is one line of the transparency table: a coloured mark, a bold
// label and a muted sub-label.
func seenRow(seen bool, label, sub string) d.Widget {
	mark, markColor := "✕", colorDanger
	if seen {
		mark, markColor = "✓", colorOK
	}
	return d.Composite{
		Layout: d.HBox{MarginsZero: true, Spacing: 10},
		Children: []d.Widget{
			d.Label{Text: mark, Font: fontOf(11, true), TextColor: markColor, MinSize: d.Size{Width: 16}},
			d.Composite{
				Layout: d.VBox{MarginsZero: true, Spacing: 0},
				Children: []d.Widget{
					d.Label{Text: label, Font: fontOf(9, true), TextColor: colorInk},
					d.Label{Text: sub, Font: fontOf(8, false), TextColor: colorMuted},
				},
			},
			d.HSpacer{},
		},
	}
}

func requireInstallerConsentFallback() (bool, error) {
	const (
		mbYesNo      = walk.MsgBoxYesNo
		mbIcon       = walk.MsgBoxIconInformation
		mbDefButton2 = walk.MsgBoxDefButton2
	)
	text := "ChaqimchiAI Family shaffof ishlaydi.\n\n" +
		"Ota-ona ko‘rishi mumkin:\n• ilova va sayt nomlari\n• ekran vaqti\n• qurilma holati\n\n" +
		"Ota-ona ko‘rmaydi:\n• xabarlar va chatlar\n• parollar\n• kamera yoki mikrofon\n• bosilgan tugmalar\n\n" +
		"Davom etish uchun roziligingizni tasdiqlang."
	res := walk.MsgBox(nil, "ChaqimchiAI Family — Shaffoflik va rozilik", text, mbYesNo|mbIcon|mbDefButton2)
	return res == walk.DlgCmdYes, nil
}
