//go:build windows

// app_icon_windows.go extracts the icon Windows shows for an executable and
// encodes it as a small PNG. The parent dashboard uses it so a child's
// activity list shows real app icons instead of raw "chrome.exe" strings.
//
// The flow: SHGetFileInfo(SHGFI_ICON|SHGFI_LARGEICON) -> HICON ->
// GetIconInfo -> the colour HBITMAP -> GetDIBits into a 32bpp top-down
// buffer -> image/png. Modern icons carry an alpha channel; for the rare
// 24-bit icon we fall back to the AND mask for transparency.
package tracker

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"image"
	"image/png"
	"sync"
	"syscall"
	"unsafe"

	"github.com/lxn/win"
)

// ExtractIconPNG renders exePath's icon to a PNG. It returns the PNG bytes,
// the lowercase-hex sha256 of those bytes, and an error.
func ExtractIconPNG(exePath string) (pngBytes []byte, sha256hex string, err error) {
	p, err := syscall.UTF16PtrFromString(exePath)
	if err != nil {
		return nil, "", err
	}
	var sfi win.SHFILEINFO
	r := win.SHGetFileInfo(p, 0, &sfi, uint32(unsafe.Sizeof(sfi)), win.SHGFI_ICON|win.SHGFI_LARGEICON)
	if r == 0 || sfi.HIcon == 0 {
		return nil, "", errors.New("SHGetFileInfo returned no icon")
	}
	defer win.DestroyIcon(sfi.HIcon)

	img, err := iconToImage(sfi.HIcon)
	if err != nil {
		return nil, "", err
	}

	var buf bytes.Buffer
	if err := (&png.Encoder{CompressionLevel: png.BestCompression}).Encode(&buf, img); err != nil {
		return nil, "", err
	}
	sum := sha256.Sum256(buf.Bytes())
	return buf.Bytes(), hex.EncodeToString(sum[:]), nil
}

func iconToImage(hicon win.HICON) (*image.NRGBA, error) {
	var ii win.ICONINFO
	if !win.GetIconInfo(hicon, &ii) {
		return nil, errors.New("GetIconInfo failed")
	}
	if ii.HbmColor != 0 {
		defer win.DeleteObject(win.HGDIOBJ(ii.HbmColor))
	}
	if ii.HbmMask != 0 {
		defer win.DeleteObject(win.HGDIOBJ(ii.HbmMask))
	}
	if ii.HbmColor == 0 {
		return nil, errors.New("icon has no colour bitmap")
	}

	var bm win.BITMAP
	if win.GetObject(win.HGDIOBJ(ii.HbmColor), unsafe.Sizeof(bm), unsafe.Pointer(&bm)) == 0 {
		return nil, errors.New("GetObject failed")
	}
	w, h := int(bm.BmWidth), int(bm.BmHeight)
	if w <= 0 || h <= 0 || w > 512 || h > 512 {
		return nil, errors.New("unexpected icon dimensions")
	}

	hdc := win.GetDC(0)
	if hdc == 0 {
		return nil, errors.New("GetDC failed")
	}
	defer win.ReleaseDC(0, hdc)

	bi := win.BITMAPINFO{}
	bi.BmiHeader.BiSize = uint32(unsafe.Sizeof(bi.BmiHeader))
	bi.BmiHeader.BiWidth = int32(w)
	bi.BmiHeader.BiHeight = -int32(h) // negative => top-down rows
	bi.BmiHeader.BiPlanes = 1
	bi.BmiHeader.BiBitCount = 32
	bi.BmiHeader.BiCompression = win.BI_RGB

	color := make([]byte, w*h*4)
	if win.GetDIBits(hdc, ii.HbmColor, 0, uint32(h), &color[0], &bi, win.DIB_RGB_COLORS) == 0 {
		return nil, errors.New("GetDIBits(colour) failed")
	}

	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	anyAlpha := false
	for i := 0; i < w*h; i++ {
		b, g, r, a := color[i*4], color[i*4+1], color[i*4+2], color[i*4+3]
		if a != 0 {
			anyAlpha = true
		}
		img.Pix[i*4], img.Pix[i*4+1], img.Pix[i*4+2], img.Pix[i*4+3] = r, g, b, a
	}

	if !anyAlpha {
		// 24-bit icon: the AND mask carries transparency (set bit => hide).
		mask := make([]byte, w*h*4)
		mbi := bi
		if win.GetDIBits(hdc, ii.HbmMask, 0, uint32(h), &mask[0], &mbi, win.DIB_RGB_COLORS) != 0 {
			for i := 0; i < w*h; i++ {
				if mask[i*4] != 0 {
					img.Pix[i*4+3] = 0
				} else {
					img.Pix[i*4+3] = 255
				}
			}
		} else {
			for i := 0; i < w*h; i++ {
				img.Pix[i*4+3] = 255
			}
		}
	}

	return img, nil
}

// IconObserver extracts an app's icon the first time that app's exe path is
// seen, then hands (appID, sha256, base64-png) to sink. It is safe for one
// goroutine; the interactive tracker and the -foreground-reporter each own
// their own instance.
type IconObserver struct {
	mu   sync.Mutex
	seen map[string]struct{} // exe path -> already extracted this run
}

// NewIconObserver returns a ready IconObserver.
func NewIconObserver() *IconObserver {
	return &IconObserver{seen: make(map[string]struct{})}
}

// Observe extracts and reports name's icon if exePath hasn't been handled
// yet. name is the exe base name (the app_id the rest of the pipeline uses);
// exePath is its full path. sink is called at most once per new exe path and
// never with empty arguments. Extraction failures are silently skipped —
// a missing icon is not worth surfacing to a parent.
func (o *IconObserver) Observe(name, exePath string, sink func(appID, sha256hex, pngB64 string)) {
	if name == "" || exePath == "" || sink == nil {
		return
	}
	o.mu.Lock()
	if _, done := o.seen[exePath]; done {
		o.mu.Unlock()
		return
	}
	o.seen[exePath] = struct{}{}
	o.mu.Unlock()

	pngBytes, shaHex, err := ExtractIconPNG(exePath)
	if err != nil || len(pngBytes) == 0 {
		return
	}
	sink(name, shaHex, base64.StdEncoding.EncodeToString(pngBytes))
}
