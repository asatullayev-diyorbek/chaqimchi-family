//go:build windows

// cmd/installer is a one-shot binary run during setup: it asks the backend
// for an enrollment code, shows it (QR + 6-digit fallback) to the user,
// waits for the parent to link the device from the mobile app, and then
// installs cmd/agent as a Windows service configured with this device's
// credentials and failure-recovery actions (see internal/service).
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/enroll"
	"github.com/chaqimchi/chaqimchi-family/agent/internal/service"
)

const serviceName = "ChaqimchiFamilyAgent"

func main() {
	baseURL := flag.String("server", "http://localhost:8000", "ChaqimchiAI backend base URL")
	agentPath := flag.String("agent-path", "", "path to agent.exe (defaults to agent.exe next to this installer)")
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	client := enroll.NewClient(*baseURL)

	hostname, _ := os.Hostname()
	code, err := client.GenerateCode(ctx, hostname)
	if err != nil {
		log.Fatalf("kod olishda xatolik: %v", err)
	}

	fmt.Println("=== ChaqimchiAI — Qurilmani bog'lash ===")
	fmt.Printf("Kod: %s\n", code.Code)
	fmt.Printf("QR:  %s\n", code.QRPayload)
	fmt.Printf("Muddati: %s\n", code.ExpiresAt.Local().Format(time.Kitchen))
	fmt.Println("Ota-ona ilovasida shu kodni kiriting yoki QR'ni skaner qiling...")

	if err := client.WaitForLink(ctx, code.DeviceID); err != nil {
		log.Fatalf("bog'lashni kutishda xatolik: %v", err)
	}

	fmt.Println("✓ Bog'landi!")

	exePath := *agentPath
	if exePath == "" {
		selfPath, err := os.Executable()
		if err != nil {
			log.Fatalf("o'z joylashuvini aniqlab bo'lmadi: %v", err)
		}
		exePath = filepath.Join(filepath.Dir(selfPath), "agent.exe")
	}

	fmt.Println("Xizmat sozlanmoqda...")
	args := []string{
		"-server", *baseURL,
		"-device-id", code.DeviceID,
		"-device-secret", code.DeviceSecret,
	}
	if err := service.Install(serviceName, "ChaqimchiAI Family Agent", exePath, args); err != nil {
		log.Fatalf("xizmatni o'rnatishda xatolik: %v", err)
	}

	fmt.Println("Tayyor! ChaqimchiAI Family endi ishlamoqda.")
}
