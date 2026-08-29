// Command relsign is the release-signing tool for agent OTA updates.
//
//	relsign rotate [-force]
//	    Generates a fresh signing key. The private half is written straight
//	    to agent/.secrets/ (0600, gitignored) and is never printed; the public
//	    half is written into pubkey.go. Use this rather than genkey — a
//	    private key that reaches a terminal has to be treated as exposed.
//
//	relsign genkey
//	    Prints both halves. Kept for the rare case of generating a key for
//	    somewhere other than this checkout; prefer rotate.
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
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	switch os.Args[1] {
	case "genkey":
		genkey()
	case "rotate":
		rotate(os.Args[2:])
	case "sign":
		sign(os.Args[2:])
	default:
		usage()
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage:")
	fmt.Fprintln(os.Stderr, "  relsign rotate [-force]              generate a key, write it to the secret file, update pubkey.go")
	fmt.Fprintln(os.Stderr, "  relsign genkey                       print a keypair (prefer rotate — this puts the private key on screen)")
	fmt.Fprintln(os.Stderr, "  relsign sign -key <file> -bin <file> [-version x.y.z]")
	os.Exit(2)
}

const (
	secretPath = "agent/.secrets/update-signing.key"
	pubkeyPath = "agent/internal/updater/pubkey.go"
)

// rotate generates a fresh signing key without ever putting the private half
// on screen — which is the whole point. The current key was generated in a
// session transcript, so it must be treated as compromised; printing the
// replacement the same way would just repeat the mistake.
//
// The private half goes straight to the gitignored secret file (0600) and the
// public half is written into pubkey.go, so nothing has to be copied by hand.
func rotate(args []string) {
	fs := flag.NewFlagSet("rotate", flag.ExitOnError)
	force := fs.Bool("force", false, "overwrite an existing secret key")
	_ = fs.Parse(args)

	root, err := repoRoot()
	must(err)
	secret := filepath.Join(root, secretPath)
	pubgo := filepath.Join(root, pubkeyPath)

	if _, err := os.Stat(secret); err == nil && !*force {
		fail("a signing key already exists at " + secretPath + "\n" +
			"       rotating it makes every agent still running the old public key unable to update.\n" +
			"       re-run with -force once you are sure.")
	}

	pub, priv, err := ed25519.GenerateKey(nil)
	must(err)

	must(os.MkdirAll(filepath.Dir(secret), 0o700))
	// 0600 and written in one shot; never logged, never echoed.
	must(os.WriteFile(secret, []byte(base64.StdEncoding.EncodeToString(priv)+"\n"), 0o600))

	source, err := os.ReadFile(pubgo)
	must(err)
	pubHex := hex.EncodeToString(pub)
	re := regexp.MustCompile(`const UpdatePublicKeyHex = "[0-9a-f]*"`)
	updated := re.ReplaceAllString(string(source), `const UpdatePublicKeyHex = "`+pubHex+`"`)
	if updated == string(source) {
		fail("could not find the UpdatePublicKeyHex constant in " + pubkeyPath)
	}
	must(os.WriteFile(pubgo, []byte(updated), 0o644))

	fmt.Println("Yangi imzolash kaliti yaratildi.")
	fmt.Println()
	fmt.Println("  private  ->", secretPath, "(0600, gitignored — ekranga chiqarilmadi)")
	fmt.Println("  public   ->", pubkeyPath)
	fmt.Println("  public key:", pubHex)
	fmt.Println()
	fmt.Println("Keyingi qadamlar:")
	fmt.Println("  1. Private kalitni parol menejeriga / CI sekretiga nusxalang — bu yagona nusxa.")
	fmt.Println("  2. pubkey.go o'zgarishini commit qiling.")
	fmt.Println("  3. Bundan keyingi har release shu kalit bilan imzolanadi.")
}

// repoRoot walks up until it finds the directory holding both agent/ and
// parent-web/, so the command works from anywhere in the tree.
func repoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "agent", "internal", "updater")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", errors.New("could not locate the repository root (no agent/internal/updater above the working directory)")
		}
		dir = parent
	}
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
