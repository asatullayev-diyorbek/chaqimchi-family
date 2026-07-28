//go:build windows

package tracker

import (
	"context"
	"encoding/json"
	"net"
	"time"
	"unsafe"

	"github.com/google/uuid"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/buffer"
)

var (
	procGetSystemPowerStatus = kernel32.NewProc("GetSystemPowerStatus")
)

// systemPowerStatus mirrors the Win32 SYSTEM_POWER_STATUS struct.
type systemPowerStatus struct {
	ACLineStatus        byte
	BatteryFlag         byte
	BatteryLifePercent  byte
	SystemStatusFlag    byte
	BatteryLifeTime     uint32
	BatteryFullLifeTime uint32
}

// batteryPercent returns 0-100, or -1 if unavailable (e.g. desktop PC with
// no battery, where BatteryLifePercent is reported as 255).
func batteryPercent() int {
	var status systemPowerStatus
	ret, _, _ := procGetSystemPowerStatus.Call(uintptr(unsafe.Pointer(&status)))
	if ret == 0 || status.BatteryLifePercent == 255 {
		return -1
	}
	return int(status.BatteryLifePercent)
}

// hasActiveNetworkInterface is a cheap local heuristic ("is there a
// non-loopback interface with an address"), NOT the captive-portal-safe
// reachability check the uploader uses before syncing — see sync/health_check.go.
func hasActiveNetworkInterface() bool {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return false
	}
	for _, addr := range addrs {
		if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
			return true
		}
	}
	return false
}

// RunDeviceInfo appends a "device_state" event every pollInterval.
func RunDeviceInfo(ctx context.Context, store *buffer.Store, pollInterval time.Duration) {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	emit := func(now time.Time) {
		payload, _ := json.Marshal(map[string]any{
			"type":        "device_state",
			"battery":     batteryPercent(),
			"online":      hasActiveNetworkInterface(),
			"occurred_at": now.UTC().Format(time.RFC3339),
		})
		store.Append(buffer.Event{
			ID:        uuid.NewString(),
			Type:      "device_state",
			Payload:   payload,
			CreatedAt: now,
		})
	}

	emit(time.Now())
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			emit(now)
		}
	}
}
