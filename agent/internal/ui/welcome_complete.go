//go:build windows

package ui

import (
	"github.com/lxn/walk"
	d "github.com/lxn/walk/declarative"
)

// ShowWelcome is installer window 1 (installer design §3.1): a one-sentence
// description and a single "Davom etish" button. It returns false if the
// operator closes or cancels the window, in which case setup must stop.
func ShowWelcome() bool {
	var (
		dlg     *walk.Dialog
		proceed bool
	)
	err := d.Dialog{
		AssignTo:   &dlg,
		Title:      "ChaqimchiAI Family — Xush kelibsiz",
		Icon:       brandIcon(),
		Background: solid(colorCanvas),
		FixedSize:  true,
		Size:       d.Size{Width: 460, Height: 380},
		Layout:     d.VBox{MarginsZero: true, Spacing: 0},
		Children: []d.Widget{
			headerBand("1 / 5"),
			d.Composite{
				Background: solid(colorCanvas),
				Layout:     d.VBox{Margins: d.Margins{Left: 24, Top: 20, Right: 24, Bottom: 16}, Spacing: 12},
				Children: []d.Widget{
					eyebrow("O‘RNATISH"),
					titleText("ChaqimchiAI Family’ga xush kelibsiz"),
					bodyText("Bu dastur farzandingizning kompyuterdan foydalanishini xavfsiz va shaffof tarzda kuzatishga yordam beradi.", 400),
					card(d.Margins{Left: 16, Top: 14, Right: 16, Bottom: 14}, 6,
						d.Label{Text: "Nima bo‘ladi", Font: fontOf(8, true), TextColor: colorAccent},
						stepLine("O‘rnatish taxminan 5 daqiqa davom etadi"),
						stepLine("Har qadamda nima sodir bo‘lishini ko‘rasiz"),
						stepLine("Windows administrator ruxsatini so‘raydi — bu normal"),
					),
					d.VSpacer{},
					footerButtons(
						d.PushButton{Text: "Bekor qilish", MinSize: d.Size{Width: 104, Height: 30}, OnClicked: func() { dlg.Cancel() }},
						d.PushButton{Text: "Davom etish", Font: fontOf(9, true), MinSize: d.Size{Width: 128, Height: 30}, OnClicked: func() { proceed = true; dlg.Accept() }},
					),
				},
			},
		},
	}.Create(nil)
	if err != nil {
		return requireInstallerConsentFallbackYesNo(
			"ChaqimchiAI Family — Xush kelibsiz",
			"Bu dastur farzandingizning kompyuterdan foydalanishini xavfsiz va shaffof tarzda kuzatishga yordam beradi.\n\nO‘rnatishni boshlaymizmi?")
	}
	dlg.Run()
	return proceed
}

// ShowComplete is installer window 5 (installer design §3.6): a confirmation
// mark and a reminder that the program keeps running in the background.
func ShowComplete() {
	var dlg *walk.Dialog
	err := d.Dialog{
		AssignTo:   &dlg,
		Title:      "ChaqimchiAI Family — Tayyor",
		Icon:       brandIcon(),
		Background: solid(colorCanvas),
		FixedSize:  true,
		Size:       d.Size{Width: 440, Height: 340},
		Layout:     d.VBox{MarginsZero: true, Spacing: 0},
		Children: []d.Widget{
			headerBand("5 / 5"),
			d.Composite{
				Background: solid(colorCanvas),
				Layout:     d.VBox{Margins: d.Margins{Left: 24, Top: 22, Right: 24, Bottom: 16}, Spacing: 12},
				Children: []d.Widget{
					d.Label{Text: "✓", Font: d.Font{Family: "Segoe UI", PointSize: 30, Bold: true}, TextColor: colorOK},
					titleText("Tayyor! ChaqimchiAI Family endi ishlamoqda."),
					bodyText("Bu oynani yopishingiz mumkin — dastur fonda ishlashda davom etadi. Farzandingizning faoliyatini ota-ona ilovasida yoki dashboardda ko‘rasiz.", 380),
					d.VSpacer{},
					footerButtons(
						d.HSpacer{},
						d.PushButton{Text: "Yopish", Font: fontOf(9, true), MinSize: d.Size{Width: 100, Height: 30}, OnClicked: func() { dlg.Accept() }},
					),
				},
			},
		},
	}.Create(nil)
	if err != nil {
		showInfoDialog("ChaqimchiAI Family — Tayyor", "ChaqimchiAI Family endi ishlamoqda. Dastur fonda ishlashda davom etadi.")
		return
	}
	dlg.Run()
}

func stepLine(text string) d.Widget {
	return d.Composite{
		Layout: d.HBox{MarginsZero: true, Spacing: 8},
		Children: []d.Widget{
			d.Label{Text: "•", Font: fontOf(10, true), TextColor: colorAccent, MinSize: d.Size{Width: 10}},
			d.Label{Text: text, Font: fontOf(9, false), TextColor: colorInk},
			d.HSpacer{},
		},
	}
}

func requireInstallerConsentFallbackYesNo(title, text string) bool {
	res := walk.MsgBox(nil, title, text, walk.MsgBoxYesNo|walk.MsgBoxIconInformation)
	return res == walk.DlgCmdYes
}
