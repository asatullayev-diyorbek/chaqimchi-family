//go:build windows

package ui

import (
	"fmt"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/lxn/walk"
	d "github.com/lxn/walk/declarative"
)

// ShowChildStatusWindow is the tray status window the child sees
// (child-ui/status.html): today's screen time, the daily limit as a
// progress bar, and a link to the plain-language "what my parent sees"
// notice. It exposes no control that could stop or weaken the agent.
func ShowChildStatusWindow(s localipc.Status, tray Status) {
	var (
		dlg     *walk.Dialog
		privacy bool
	)

	// Headline state.
	eyebrowText, heading := "HAMMASI JOYIDA", "Buguningni xotirjam davom ettir."
	if !s.Online || tray == StatusOffline {
		eyebrowText, heading = "INTERNET ALOQASI YO‘Q", "Aloqa tiklanganda ma’lumot yuboriladi."
	} else if tray == StatusWarning {
		eyebrowText, heading = "OGOHLANTIRISH", "Bugungi limitingga yaqin qolding."
	}

	timeCard := []d.Widget{
		d.Composite{
			Layout: d.HBox{MarginsZero: true},
			Children: []d.Widget{
				d.Label{Text: "Bugungi ekran vaqting", Font: fontOf(9, false), TextColor: colorMuted},
				d.HSpacer{},
			},
		},
		d.Label{Text: humanDuration(s.TodayMinutes), Font: d.Font{Family: "Segoe UI", PointSize: 20, Bold: true}, TextColor: colorInk},
	}
	if s.DailyLimitMinutes > 0 {
		remaining := s.DailyLimitMinutes - s.TodayMinutes
		if remaining < 0 {
			remaining = 0
		}
		val := s.TodayMinutes
		if val > s.DailyLimitMinutes {
			val = s.DailyLimitMinutes
		}
		timeCard = append(timeCard,
			d.ProgressBar{Value: val, MaxValue: s.DailyLimitMinutes, MinSize: d.Size{Height: 8}, MaxSize: d.Size{Height: 8}},
			d.Composite{
				Layout: d.HBox{MarginsZero: true},
				Children: []d.Widget{
					d.Label{Text: "Kunlik limit: " + humanDuration(s.DailyLimitMinutes), Font: fontOf(8, false), TextColor: colorFaint},
					d.HSpacer{},
					d.Label{Text: humanDuration(remaining) + " qoldi", Font: fontOf(8, true), TextColor: colorAccent},
				},
			},
		)
	} else {
		timeCard = append(timeCard,
			d.Label{Text: "Kunlik limit belgilanmagan.", Font: fontOf(8, false), TextColor: colorFaint},
		)
	}

	err := d.Dialog{
		AssignTo:   &dlg,
		Title:      "ChaqimchiAI Child — Holat",
		Icon:       brandIcon(),
		Background: solid(colorCanvas),
		FixedSize:  true,
		Size:       d.Size{Width: 400, Height: 400},
		Layout:     d.VBox{MarginsZero: true, Spacing: 0},
		Children: []d.Widget{
			headerBand(""),
			d.Composite{
				Background: solid(colorCanvas),
				Layout:     d.VBox{Margins: d.Margins{Left: 24, Top: 18, Right: 24, Bottom: 16}, Spacing: 10},
				Children: []d.Widget{
					eyebrow(eyebrowText),
					titleText(heading),
					card(d.Margins{Left: 16, Top: 14, Right: 16, Bottom: 14}, 8, timeCard...),
					d.VSpacer{},
					d.PushButton{
						Text:      "Ota-onam nimani ko‘radi?",
						MinSize:   d.Size{Height: 30},
						OnClicked: func() { privacy = true; dlg.Accept() },
					},
					footerButtons(
						d.HSpacer{},
						d.PushButton{Text: "Yopish", Font: fontOf(9, true), MinSize: d.Size{Width: 100, Height: 30}, OnClicked: func() { dlg.Accept() }},
					),
				},
			},
		},
	}.Create(nil)
	if err != nil {
		ShowChildStatus(tray)
		return
	}
	dlg.Run()
	if privacy {
		ShowPrivacyNotice()
	}
}

// humanDuration renders whole minutes as "2 soat 15 daq" / "45 daq" / "0 daq".
func humanDuration(minutes int) string {
	if minutes < 0 {
		minutes = 0
	}
	h, m := minutes/60, minutes%60
	switch {
	case h > 0 && m > 0:
		return fmt.Sprintf("%d soat %d daq", h, m)
	case h > 0:
		return fmt.Sprintf("%d soat", h)
	default:
		return fmt.Sprintf("%d daq", m)
	}
}
