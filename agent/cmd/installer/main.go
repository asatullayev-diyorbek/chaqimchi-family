// cmd/installer is a one-shot binary run during setup: it asks the backend
// for an enrollment code, shows it (QR + 6-digit fallback) to the user, and
// waits for the parent to link the device from the mobile app.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/chaqimchi/chaqimchi-family/agent/internal/enroll"
)

func main() {
	baseURL := flag.String("server", "http://localhost:8000", "ChaqimchiAI backend base URL")
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
}
