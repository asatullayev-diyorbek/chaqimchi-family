//go:build windows

package ui

import (
	"image"
	"image/color"
	"math"
	"sync"

	"github.com/lxn/walk"
	d "github.com/lxn/walk/declarative"
)

// Shared visual language for the agent's Windows windows. The operator here
// is the parent, so the tone matches the parent/desktop panels: professional,
// calm, a blue-green accent — not the playful child-side look
// (chaqimchiai-family-ornatuvchi-dizayn-talablari.md §5). walk paints native
// Win32 controls, so the design leans on what actually renders well there:
// a coloured header band, generous white space, a tight type scale, and
// hairline-framed cards rather than shadows or rounded corners it can't draw.
var (
	colorAccent     = walk.RGB(0x0E, 0x7C, 0x7B) // deep teal — brand
	colorAccentDark = walk.RGB(0x0A, 0x5F, 0x5E) // header band base
	colorInk        = walk.RGB(0x1F, 0x23, 0x28) // near-black body text
	colorMuted      = walk.RGB(0x67, 0x6E, 0x75) // secondary text
	colorFaint      = walk.RGB(0x8A, 0x92, 0x99) // captions
	colorCanvas     = walk.RGB(0xF4, 0xF5, 0xF7) // window background
	colorCard       = walk.RGB(0xFF, 0xFF, 0xFF) // raised surface
	colorHair       = walk.RGB(0xDF, 0xE2, 0xE6) // hairline separators
	colorDanger     = walk.RGB(0xC0, 0x39, 0x2B) // errors
	colorOK         = walk.RGB(0x1E, 0x8E, 0x3E) // success
	colorOnAccent   = walk.RGB(0xFF, 0xFF, 0xFF) // text on the accent band
	colorAccentSub  = walk.RGB(0xC7, 0xE9, 0xE8) // muted text on the accent band
)

func fontOf(pt int, bold bool) d.Font { return d.Font{Family: "Segoe UI", PointSize: pt, Bold: bold} }

func solid(c walk.Color) d.SolidColorBrush { return d.SolidColorBrush{Color: c} }

// --- text helpers: one place for the type scale ---------------------------

func eyebrow(text string) d.Widget {
	return d.Label{Text: text, Font: fontOf(8, true), TextColor: colorAccent}
}

func titleText(text string) d.Widget {
	return d.Label{Text: text, Font: fontOf(15, true), TextColor: colorInk}
}

func bodyText(text string, width int) d.Widget {
	return d.TextLabel{Text: text, Font: fontOf(9, false), TextColor: colorMuted, MinSize: d.Size{Width: width}}
}

func mutedText(text string) d.Widget {
	return d.Label{Text: text, Font: fontOf(9, false), TextColor: colorMuted}
}

// --- structural helpers --------------------------------------------------

// headerBand is the accent-coloured strip across the top of every window: a
// small rounded mark, the wordmark in white, and an optional step indicator
// ("2 / 5") on the right.
func headerBand(step string) d.Widget {
	children := []d.Widget{
		d.ImageView{Image: markBitmap(), MinSize: d.Size{Width: 22, Height: 22}, MaxSize: d.Size{Width: 22, Height: 22}},
		d.Label{Text: "ChaqimchiAI Guard", Font: fontOf(11, true), TextColor: colorOnAccent},
		d.HSpacer{},
	}
	if step != "" {
		children = append(children, d.Label{Text: step, Font: fontOf(9, false), TextColor: colorAccentSub})
	}
	return d.Composite{
		Background: solid(colorAccentDark),
		MinSize:    d.Size{Height: 52},
		MaxSize:    d.Size{Height: 52},
		Layout:     d.HBox{Margins: d.Margins{Left: 22, Top: 0, Right: 22, Bottom: 0}, Spacing: 10},
		Children:   children,
	}
}

// card wraps content in a white surface with a hairline frame. walk has no
// border radius or shadow, so a crisp 1px outline is the cleanest available
// separation from the canvas.
func card(margins d.Margins, spacing int, children ...d.Widget) d.Widget {
	return d.Composite{
		Background: solid(colorHair),
		Layout:     d.VBox{Margins: d.Margins{Left: 1, Top: 1, Right: 1, Bottom: 1}, MarginsZero: false, Spacing: 0},
		Children: []d.Widget{
			d.Composite{
				Background: solid(colorCard),
				Layout:     d.VBox{Margins: margins, Spacing: spacing},
				Children:   children,
			},
		},
	}
}

// hairline is a 1px separator that reads cleaner than the etched HSeparator.
func hairline() d.Widget {
	return d.Composite{Background: solid(colorHair), MinSize: d.Size{Height: 1}, MaxSize: d.Size{Height: 1}}
}

// footerButtons lays out the standard Windows-installer button row: a
// secondary action on the left, the primary on the right.
func footerButtons(left, right d.Widget) d.Widget {
	return d.Composite{
		Layout:   d.HBox{MarginsZero: true, Spacing: 8},
		Children: []d.Widget{left, d.HSpacer{}, right},
	}
}

// --- generated bitmaps --------------------------------------------------

func filled(n int, c color.RGBA) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, n, n))
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			img.SetRGBA(x, y, c)
		}
	}
	return img
}

// roundedSquare draws an anti-aliased rounded square of colour c on a
// transparent field, supersampled 4x so the corners stay smooth after walk
// scales the bitmap for the monitor DPI.
func roundedSquare(size int, radiusFrac float64, c color.RGBA) *image.RGBA {
	const ss = 4
	n := size * ss
	r := float64(n) * radiusFrac
	img := image.NewRGBA(image.Rect(0, 0, n, n))
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			fx, fy := float64(x)+0.5, float64(y)+0.5
			// distance outside the rounded-rect boundary
			dx := math.Max(math.Max(r-fx, fx-(float64(n)-r)), 0)
			dy := math.Max(math.Max(r-fy, fy-(float64(n)-r)), 0)
			dist := math.Hypot(dx, dy) - r
			var a float64
			switch {
			case dist <= 0:
				a = 1
			case dist >= 1:
				a = 0
			default:
				a = 1 - dist
			}
			col := c
			col.A = uint8(float64(c.A) * a)
			img.SetRGBA(x, y, col)
		}
	}
	return downsample(img, ss)
}

// flatten composites src over an opaque background colour, so the result
// needs no alpha channel — walk's ImageView renders opaque bitmaps most
// reliably.
func flatten(src *image.RGBA, bg color.RGBA) *image.RGBA {
	b := src.Bounds()
	out := image.NewRGBA(b)
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			p := src.RGBAAt(x, y)
			a := float64(p.A) / 255
			out.SetRGBA(x, y, color.RGBA{
				R: uint8(float64(p.R)*a + float64(bg.R)*(1-a)),
				G: uint8(float64(p.G)*a + float64(bg.G)*(1-a)),
				B: uint8(float64(p.B)*a + float64(bg.B)*(1-a)),
				A: 0xFF,
			})
		}
	}
	return out
}

func downsample(src *image.RGBA, factor int) *image.RGBA {
	w, h := src.Bounds().Dx()/factor, src.Bounds().Dy()/factor
	out := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var r, g, b, a int
			for sy := 0; sy < factor; sy++ {
				for sx := 0; sx < factor; sx++ {
					px := src.RGBAAt(x*factor+sx, y*factor+sy)
					r += int(px.R)
					g += int(px.G)
					b += int(px.B)
					a += int(px.A)
				}
			}
			d2 := factor * factor
			out.SetRGBA(x, y, color.RGBA{uint8(r / d2), uint8(g / d2), uint8(b / d2), uint8(a / d2)})
		}
	}
	return out
}

var (
	markOnce   sync.Once
	markBmpVal *walk.Bitmap
	iconOnce   sync.Once
	iconVal    *walk.Icon
)

func markBitmap() *walk.Bitmap {
	markOnce.Do(func() {
		mark := flatten(
			roundedSquare(22, 0.28, color.RGBA{R: 0x2F, G: 0xC7, B: 0xC4, A: 0xFF}),
			color.RGBA{R: 0x0A, G: 0x5F, B: 0x5E, A: 0xFF}, // colorAccentDark
		)
		markBmpVal, _ = walk.NewBitmapFromImageForDPI(mark, 96)
	})
	return markBmpVal
}

// brandIcon is the titlebar/taskbar icon: a rounded accent square. Detail is
// lost at 16 px anyway, so the brand colour carries it.
func brandIcon() *walk.Icon {
	iconOnce.Do(func() {
		iconVal, _ = walk.NewIconFromImageForDPI(
			roundedSquare(32, 0.28, color.RGBA{R: 0x0E, G: 0x7C, B: 0x7B, A: 0xFF}), 96)
	})
	return iconVal
}
