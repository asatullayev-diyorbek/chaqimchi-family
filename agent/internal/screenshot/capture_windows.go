//go:build windows

package screenshot

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"

	"github.com/kbinani/screenshot"
	xdraw "golang.org/x/image/draw"
)

// maxWidth caps the stitched image; a multi-monitor desktop can be
// 5000px+ wide, which is needless bandwidth (and detail) for a parent
// glancing at what's on screen. Downscaled with a good filter past this.
const maxWidth = 2560

// jpegQuality trades size for fidelity — 72 keeps text readable at a fraction
// of a PNG's size.
const jpegQuality = 72

// Capture grabs every active display, lays them out left to right in one
// image, downscales if very wide, and returns a JPEG plus its pixel size.
func Capture() (data []byte, width, height int, err error) {
	n := screenshot.NumActiveDisplays()
	if n <= 0 {
		return nil, 0, 0, fmt.Errorf("no active displays")
	}

	var shots []*image.RGBA
	totalW, maxH := 0, 0
	for i := 0; i < n; i++ {
		img, capErr := screenshot.CaptureDisplay(i)
		if capErr != nil || img == nil {
			continue
		}
		shots = append(shots, img)
		totalW += img.Bounds().Dx()
		if h := img.Bounds().Dy(); h > maxH {
			maxH = h
		}
	}
	if len(shots) == 0 {
		return nil, 0, 0, fmt.Errorf("all displays failed to capture")
	}

	canvas := image.NewRGBA(image.Rect(0, 0, totalW, maxH))
	draw.Draw(canvas, canvas.Bounds(), image.NewUniform(color.Black), image.Point{}, draw.Src)
	x := 0
	for _, s := range shots {
		r := image.Rect(x, 0, x+s.Bounds().Dx(), s.Bounds().Dy())
		draw.Draw(canvas, r, s, s.Bounds().Min, draw.Src)
		x += s.Bounds().Dx()
	}

	var out image.Image = canvas
	if totalW > maxWidth {
		nh := maxH * maxWidth / totalW
		if nh < 1 {
			nh = 1
		}
		dst := image.NewRGBA(image.Rect(0, 0, maxWidth, nh))
		xdraw.CatmullRom.Scale(dst, dst.Bounds(), canvas, canvas.Bounds(), xdraw.Src, nil)
		out = dst
	}

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, out, &jpeg.Options{Quality: jpegQuality}); err != nil {
		return nil, 0, 0, err
	}
	b := out.Bounds()
	return buf.Bytes(), b.Dx(), b.Dy(), nil
}
