//go:build windows

package ui

import (
	"image"
	"image/color"
	"sync"

	"github.com/lxn/walk"
	d "github.com/lxn/walk/declarative"
)

// Shared visual language for the installer windows. The installer targets the
// parent as operator, so the tone matches the parent/desktop panels:
// professional, calm, a blue-green accent — not the playful child-side look
// (chaqimchiai-family-ornatuvchi-dizayn-talablari.md §5).
var (
	colorAccent = walk.RGB(0x0E, 0x7C, 0x7B) // deep teal
	colorInk    = walk.RGB(0x1F, 0x23, 0x28) // near-black body text
	colorMuted  = walk.RGB(0x67, 0x6E, 0x75) // secondary text
	colorCanvas = walk.RGB(0xF4, 0xF5, 0xF7) // window background
	colorCard   = walk.RGB(0xFF, 0xFF, 0xFF) // raised surface
	colorHair   = walk.RGB(0xDF, 0xE2, 0xE6) // hairline separators
	colorDanger = walk.RGB(0xC0, 0x39, 0x2B) // errors
	colorOK     = walk.RGB(0x1E, 0x8E, 0x3E) // success
)

func fontOf(pt int, bold bool) d.Font { return d.Font{Family: "Segoe UI", PointSize: pt, Bold: bold} }

func solid(c walk.Color) d.SolidColorBrush { return d.SolidColorBrush{Color: c} }

// brandRow is the small mark + wordmark shown at the top of every installer
// window.
func brandRow() d.Widget {
	return d.Composite{
		Layout: d.HBox{MarginsZero: true, Spacing: 9},
		Children: []d.Widget{
			d.ImageView{Image: markBitmap(), MinSize: d.Size{Width: 18, Height: 18}, MaxSize: d.Size{Width: 18, Height: 18}},
			d.Label{Text: "ChaqimchiAI Guard", Font: fontOf(10, true), TextColor: colorInk},
			d.HSpacer{},
		},
	}
}

// hairline is a 1px separator that reads cleaner than the etched HSeparator.
func hairline() d.Widget {
	return d.Composite{Background: solid(colorHair), MinSize: d.Size{Height: 1}, MaxSize: d.Size{Height: 1}}
}

func filled(n int, c color.RGBA) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, n, n))
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			img.SetRGBA(x, y, c)
		}
	}
	return img
}

var (
	markOnce   sync.Once
	markBmpVal *walk.Bitmap
	iconOnce   sync.Once
	iconVal    *walk.Icon
)

func markBitmap() *walk.Bitmap {
	markOnce.Do(func() {
		markBmpVal, _ = walk.NewBitmapFromImage(filled(18, color.RGBA{R: 0x0E, G: 0x7C, B: 0x7B, A: 0xFF}))
	})
	return markBmpVal
}

// brandIcon is the titlebar/taskbar icon: a solid accent square. Detail is
// lost at 16 px anyway, so the brand colour alone carries it.
func brandIcon() *walk.Icon {
	iconOnce.Do(func() {
		iconVal, _ = walk.NewIconFromImage(filled(32, color.RGBA{R: 0x0E, G: 0x7C, B: 0x7B, A: 0xFF}))
	})
	return iconVal
}
