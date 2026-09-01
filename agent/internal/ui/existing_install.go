//go:build windows

package ui

import (
	"github.com/lxn/walk"
	d "github.com/lxn/walk/declarative"
)

// ExistingChoice is what the operator picked when the installer found Guard
// already registered on this machine.
type ExistingChoice int

const (
	ExistingCancel  ExistingChoice = iota // do nothing, leave the current install alone
	ExistingUpgrade                       // replace the binary, keep the enrolled device
	ExistingRelink                        // stop the old service and pair again from scratch
)

// AskExistingInstall is shown when the installer detects a prior Guard
// install (installer design §2.4 / §6: irreversible actions are spelled out
// first). Overwriting a working agent silently is exactly what this avoids.
func AskExistingInstall(running bool) ExistingChoice {
	state := "Hozir ishlab turibdi."
	if !running {
		state = "Hozir to‘xtagan."
	}

	var (
		dlg    *walk.Dialog
		choice = ExistingCancel
	)
	err := d.Dialog{
		AssignTo:   &dlg,
		Title:      "ChaqimchiAI Guard — Allaqachon o‘rnatilgan",
		Icon:       brandIcon(),
		Background: solid(colorCanvas),
		FixedSize:  true,
		Size:       d.Size{Width: 480, Height: 430},
		Layout:     d.VBox{MarginsZero: true, Spacing: 0},
		Children: []d.Widget{
			headerBand(""),
			d.Composite{
				Background: solid(colorCanvas),
				Layout:     d.VBox{Margins: d.Margins{Left: 24, Top: 18, Right: 24, Bottom: 16}, Spacing: 10},
				Children: []d.Widget{
					eyebrow("ALLAQACHON O‘RNATILGAN"),
					titleText("Bu kompyuterda Guard allaqachon bor"),
					bodyText("ChaqimchiAI Guard xizmati shu kompyuterda topildi. "+state+" Nima qilishni tanlang:", 420),
					card(d.Margins{Left: 16, Top: 12, Right: 16, Bottom: 12}, 8,
						choiceLine("Yangilash", "Dasturni yangi versiyaga almashtiradi. Qurilma o‘sha oilaga bog‘langan holda qoladi — qayta kod kiritish shart emas."),
						hairline(),
						choiceLine("Qayta bog‘lash", "Eski xizmatni to‘xtatadi va qurilmani yangi kod bilan boshqa hisobga bog‘laydi."),
					),
					d.VSpacer{},
					d.Composite{
						Layout: d.HBox{MarginsZero: true, Spacing: 8},
						Children: []d.Widget{
							d.PushButton{Text: "Bekor qilish", MinSize: d.Size{Width: 96, Height: 30}, OnClicked: func() { dlg.Cancel() }},
							d.HSpacer{},
							d.PushButton{Text: "Qayta bog‘lash", MinSize: d.Size{Width: 118, Height: 30}, OnClicked: func() { choice = ExistingRelink; dlg.Accept() }},
							d.PushButton{Text: "Yangilash", Font: fontOf(9, true), MinSize: d.Size{Width: 104, Height: 30}, OnClicked: func() { choice = ExistingUpgrade; dlg.Accept() }},
						},
					},
				},
			},
		},
	}.Create(nil)
	if err != nil {
		res := walk.MsgBox(nil, "ChaqimchiAI Guard — Allaqachon o‘rnatilgan",
			"Guard allaqachon o‘rnatilgan. Yangi versiyaga yangilaymizmi?\n\n"+
				"Ha — yangilash (qurilma o‘sha hisobda qoladi)\nYo‘q — bekor qilish",
			walk.MsgBoxYesNo|walk.MsgBoxIconQuestion)
		if res == walk.DlgCmdYes {
			return ExistingUpgrade
		}
		return ExistingCancel
	}
	dlg.Run()
	return choice
}

func choiceLine(title, body string) d.Widget {
	return d.Composite{
		Layout: d.VBox{MarginsZero: true, Spacing: 2},
		Children: []d.Widget{
			d.Label{Text: title, Font: fontOf(9, true), TextColor: colorAccent},
			d.TextLabel{Text: body, Font: fontOf(8, false), TextColor: colorMuted, MinSize: d.Size{Width: 380}},
		},
	}
}
