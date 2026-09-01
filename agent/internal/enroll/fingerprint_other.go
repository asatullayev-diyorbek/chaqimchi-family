//go:build !windows

package enroll

// HardwareID has no meaningful value off Windows (the agent only ships for
// Windows); tests and cross-platform builds get an empty fingerprint.
func HardwareID() string { return "" }
