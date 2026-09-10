//go:build !windows

package screenshot

import "fmt"

// Capture is Windows-only; this stub keeps the package building on the dev
// machine (macOS/Linux) for tests of the client/coordinator logic.
func Capture() (data []byte, width, height int, err error) {
	return nil, 0, 0, fmt.Errorf("screen capture is only supported on Windows")
}
