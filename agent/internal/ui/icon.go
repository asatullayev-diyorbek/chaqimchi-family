//go:build windows

package ui

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
)

var iconCache = map[Status][]byte{}

// iconFor returns (and caches) a small solid-color .ico for the given
// status. There are no bundled icon image assets — per the bola-app doc
// (4.1-bo'lim), color alone is the signal (green/yellow/gray), so a
// generated solid square is sufficient and avoids checking binary image
// files into the repo.
func iconFor(status Status) []byte {
	if cached, ok := iconCache[status]; ok {
		return cached
	}
	data := generateICO(colorFor(status), 32)
	iconCache[status] = data
	return data
}

func colorFor(status Status) color.RGBA {
	switch status {
	case StatusWarning:
		return color.RGBA{R: 0xff, G: 0xcc, B: 0x00, A: 0xff} // yellow
	case StatusOffline:
		return color.RGBA{R: 0x8e, G: 0x8e, B: 0x93, A: 0xff} // gray
	default:
		return color.RGBA{R: 0x34, G: 0xc7, B: 0x59, A: 0xff} // green
	}
}

// generateICO builds a minimal single-image .ico containing one PNG frame,
// a format Windows has accepted inside ICO containers since Vista.
func generateICO(c color.RGBA, size int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			img.Set(x, y, c)
		}
	}
	var pngBuf bytes.Buffer
	_ = png.Encode(&pngBuf, img)
	pngBytes := pngBuf.Bytes()

	var out bytes.Buffer
	// ICONDIR
	binary.Write(&out, binary.LittleEndian, uint16(0)) // reserved
	binary.Write(&out, binary.LittleEndian, uint16(1)) // type: icon
	binary.Write(&out, binary.LittleEndian, uint16(1)) // image count

	// ICONDIRENTRY (16 bytes) immediately follows the 6-byte ICONDIR.
	widthByte := byte(size)
	if size >= 256 {
		widthByte = 0
	}
	out.WriteByte(widthByte)
	out.WriteByte(widthByte)
	out.WriteByte(0)                                               // color count (0 = no palette, true color)
	out.WriteByte(0)                                               // reserved
	binary.Write(&out, binary.LittleEndian, uint16(1))             // color planes
	binary.Write(&out, binary.LittleEndian, uint16(32))            // bits per pixel
	binary.Write(&out, binary.LittleEndian, uint32(len(pngBytes))) // image data size
	binary.Write(&out, binary.LittleEndian, uint32(6+16))          // offset of image data

	out.Write(pngBytes)
	return out.Bytes()
}
