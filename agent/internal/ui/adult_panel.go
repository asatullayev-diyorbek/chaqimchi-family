//go:build windows

package ui

import (
	"os/exec"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/localipc"
	"github.com/lxn/walk"
	d "github.com/lxn/walk/declarative"
)

// ShowAdultAccessGate is shown before the local "Kattalar uchun" panel
// (installer design §4). There is no password: opening the panel is instead
// always reported to the parent (dashboard + Telegram), and this dialog says
// so plainly. It returns true if the operator chooses to continue.
func ShowAdultAccessGate() bool {
	var (
		dlg *walk.Dialog
		ok  bool
	)
	err := d.Dialog{
		AssignTo:   &dlg,
		Title:      "ChaqimchiAI Guard — Kattalar uchun",
		Icon:       brandIcon(),
		Background: solid(colorCanvas),
		FixedSize:  true,
		Size:       d.Size{Width: 420, Height: 320},
		Layout:     d.VBox{MarginsZero: true, Spacing: 0},
		Children: []d.Widget{
			headerBand(""),
			d.Composite{
				Background: solid(colorCanvas),
				Layout:     d.VBox{Margins: d.Margins{Left: 24, Top: 18, Right: 24, Bottom: 16}, Spacing: 10},
				Children: []d.Widget{
					eyebrow("KATTALAR UCHUN"),
					titleText("Bu bo‘lim ota-onaga bildiriladi"),
					card(d.Margins{Left: 16, Top: 14, Right: 16, Bottom: 14}, 0,
						d.TextLabel{
							Text: "Bu panel faqat ota-ona uchun. Ochilishi ota-ona paneliga va Telegram orqali xabar sifatida yuboriladi — bu shaffoflik uchun ataylab shunday.\n\nDavom etasizmi?",
							Font: fontOf(9, false), TextColor: colorInk, MinSize: d.Size{Width: 344},
						},
					),
					d.VSpacer{},
					footerButtons(
						d.PushButton{Text: "Bekor qilish", MinSize: d.Size{Width: 104, Height: 30}, OnClicked: func() { dlg.Cancel() }},
						d.PushButton{Text: "Davom etish", Font: fontOf(9, true), MinSize: d.Size{Width: 128, Height: 30}, OnClicked: func() { ok = true; dlg.Accept() }},
					),
				},
			},
		},
	}.Create(nil)
	if err != nil {
		return requireInstallerConsentFallbackYesNo("ChaqimchiAI Guard — Kattalar uchun",
			"Bu panel ota-ona paneliga va Telegramga xabar sifatida yuboriladi. Davom etasizmi?")
	}
	dlg.Run()
	return ok
}

// ShowAdultPanel is the local settings panel (installer design §4): device
// status, where the diagnostic log lives, a help link and the standard
// Windows uninstall path. It exposes nothing that can weaken the agent —
// re-link and diagnostic upload need a backend and are deferred.
func ShowAdultPanel(s localipc.Status, supportURL, logPath string) {
	online := "Ulangan"
	onlineColor := colorOK
	if !s.Online {
		online, onlineColor = "Uzilgan", colorDanger
	}
	lastSync := s.LastSyncAt
	if lastSync == "" {
		lastSync = "hali yo‘q"
	}

	var dlg *walk.Dialog
	err := d.Dialog{
		AssignTo:   &dlg,
		Title:      "ChaqimchiAI Guard — Kattalar paneli",
		Icon:       brandIcon(),
		Background: solid(colorCanvas),
		FixedSize:  true,
		Size:       d.Size{Width: 460, Height: 470},
		Layout:     d.VBox{MarginsZero: true, Spacing: 0},
		Children: []d.Widget{
			headerBand(""),
			d.Composite{
				Background: solid(colorCanvas),
				Layout:     d.VBox{Margins: d.Margins{Left: 24, Top: 18, Right: 24, Bottom: 16}, Spacing: 10},
				Children: []d.Widget{
					eyebrow("QURILMA HOLATI"),
					titleText("ChaqimchiAI Guard"),
					card(d.Margins{Left: 16, Top: 12, Right: 16, Bottom: 12}, 6,
						kvRow("Server bilan aloqa", online, onlineColor),
						kvRow("Oxirgi sinxronizatsiya", lastSync, colorInk),
						kvRow("Agent versiyasi", s.Version, colorInk),
						kvRow("Bugungi ekran vaqti", humanDuration(s.TodayMinutes), colorInk),
					),
					eyebrow("DIAGNOSTIKA"),
					card(d.Margins{Left: 16, Top: 12, Right: 16, Bottom: 12}, 4,
						d.Label{Text: "Diagnostika jurnali shu faylda:", Font: fontOf(9, false), TextColor: colorMuted},
						d.LineEdit{Text: logPath, ReadOnly: true, Font: fontOf(8, false)},
					),
					d.VSpacer{},
					footerButtons(
						d.PushButton{Text: "O‘chirish (Windows)", MinSize: d.Size{Width: 150, Height: 30}, OnClicked: func() {
							openExternal("ms-settings:appsfeatures")
						}},
						d.Composite{
							Layout: d.HBox{MarginsZero: true, Spacing: 8},
							Children: []d.Widget{
								d.PushButton{Text: "Yordam", MinSize: d.Size{Width: 90, Height: 30}, OnClicked: func() {
									if supportURL != "" {
										openExternal(supportURL)
									}
								}},
								d.PushButton{Text: "Yopish", Font: fontOf(9, true), MinSize: d.Size{Width: 90, Height: 30}, OnClicked: func() { dlg.Accept() }},
							},
						},
					),
				},
			},
		},
	}.Create(nil)
	if err != nil {
		showInfoDialog("ChaqimchiAI Guard — Kattalar paneli",
			"Aloqa: "+online+"\nOxirgi sinxronizatsiya: "+lastSync+"\nVersiya: "+s.Version+"\nDiagnostika jurnali: "+logPath)
		return
	}
	dlg.Run()
}

func kvRow(key, value string, valueColor walk.Color) d.Widget {
	return d.Composite{
		Layout: d.HBox{MarginsZero: true, Spacing: 10},
		Children: []d.Widget{
			d.Label{Text: key, Font: fontOf(9, false), TextColor: colorMuted},
			d.HSpacer{},
			d.Label{Text: value, Font: fontOf(9, true), TextColor: valueColor},
		},
	}
}

// openExternal hands a URL or ms-settings: URI to the shell. Best-effort:
// a failure here should never crash the panel.
func openExternal(target string) {
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", target).Start()
}
