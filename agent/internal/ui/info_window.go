//go:build windows

package ui

import (
	"github.com/lxn/walk"
	d "github.com/lxn/walk/declarative"
)

// showInfoWindow presents a short read-only message in a themed window,
// matching the installer/enrollment look. It is used for the child-facing
// tray items ("Bugungi holat", "Oxirgi amallar", "Nima kuzatiladi") which
// previously rendered as bare Win32 message boxes. If the window can't be
// built it falls back to the message box so nothing is ever swallowed.
func showInfoWindow(title, eyebrowText, heading, body string) {
	var dlg *walk.Dialog
	err := d.Dialog{
		AssignTo:   &dlg,
		Title:      title,
		Icon:       brandIcon(),
		Background: solid(colorCanvas),
		FixedSize:  true,
		Size:       d.Size{Width: 420, Height: 360},
		Layout:     d.VBox{MarginsZero: true, Spacing: 0},
		Children: []d.Widget{
			headerBand(""),
			d.Composite{
				Background: solid(colorCanvas),
				Layout:     d.VBox{Margins: d.Margins{Left: 24, Top: 18, Right: 24, Bottom: 16}, Spacing: 10},
				Children: []d.Widget{
					eyebrow(eyebrowText),
					titleText(heading),
					card(d.Margins{Left: 16, Top: 14, Right: 16, Bottom: 14}, 0,
						d.TextLabel{Text: body, Font: fontOf(9, false), TextColor: colorInk, MinSize: d.Size{Width: 344}},
					),
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
		showInfoDialog(title, heading+"\n\n"+body)
		return
	}
	dlg.Run()
}
