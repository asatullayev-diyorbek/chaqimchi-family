// Command relsign is the release-signing tool for agent OTA updates.
//
//	relsign genkey
//	    Generates an Ed25519 keypair. Print the PUBLIC key hex into
//	    agent/internal/updater/pubkey.go and keep the PRIVATE key secret
//	    (a password manager / CI secret) — it never goes in the repo.
//
//	relsign sign -key <private-key-file> -bin <path-to-agent.exe> [-version 0.5.0]
//	    Prints the sha256, the base64 Ed25519 signature over the exact
//	    binary bytes, and a ready-to-paste AgentVersion manifest.
//
// The agent verifies both sha256 and signature (internal/updater/verify.go)
// against the pinned public key before it ever swaps a binary into place.
package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	switch os.Args[1] {
	case "genkey":
		genkey()
	case "sign":
		sign(os.Args[2:])
	default:
		usage()
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: relsign genkey | relsign sign -key <file> -bin <file> [-version x.y.z]")
	os.Exit(2)
}

func genkey() {
	pub, priv, err := ed25519.GenerateKey(nil)
	must(err)
	fmt.Println("# Ed25519 update-signing keypair")
	fmt.Println()
	fmt.Println("PUBLIC KEY (paste into agent/internal/updater/pubkey.go):")
	fmt.Println("  " + hex.EncodeToString(pub))
	fmt.Println()
	fmt.Println("PRIVATE KEY (store as a secret — NEVER commit; feed to `relsign sign -key`):")
	fmt.Println("  " + base64.StdEncoding.EncodeToString(priv))
}

func sign(args []string) {
	fs := flag.NewFlagSet("sign", flag.ExitOnError)
	keyFile := fs.String("key", "", "path to the base64 Ed25519 private key file")
	binFile := fs.String("bin", "", "path to the binary to sign")
	version := fs.String("version", "", "version string for the printed manifest")
	_ = fs.Parse(args)
	if *keyFile == "" || *binFile == "" {
		usage()
	}

	keyText, err := os.ReadFile(*keyFile)
	must(err)
	privRaw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(keyText)))
	must(err)
	if len(privRaw) != ed25519.PrivateKeySize {
		fail(fmt.Sprintf("private key must be %d bytes, got %d", ed25519.PrivateKeySize, len(privRaw)))
	}
	priv := ed25519.PrivateKey(privRaw)

	bin, err := os.ReadFile(*binFile)
	must(err)

	sum := sha256.Sum256(bin)
	sig := ed25519.Sign(priv, bin)

	sha256hex := hex.EncodeToString(sum[:])
	sigB64 := base64.StdEncoding.EncodeToString(sig)

	fmt.Println("sha256   :", sha256hex)
	fmt.Println("signature:", sigB64)
	fmt.Println("bytes    :", len(bin))
	fmt.Println()
	manifest := map[string]any{
		"version":   *version,
		"sha256":    sha256hex,
		"signature": sigB64,
		"mandatory": false,
	}
	out, _ := json.MarshalIndent(manifest, "", "  ")
	fmt.Println("AgentVersion fields:")
	fmt.Println(string(out))
}

func must(err error) {
	if err != nil {
		fail(err.Error())
	}
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, "relsign: "+msg)
	os.Exit(1)
}
