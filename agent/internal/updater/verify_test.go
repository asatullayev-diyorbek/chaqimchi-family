package updater

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"testing"
)

// signWith reproduces what `relsign sign` does, so the tests exercise the
// real verification path end to end.
func signWith(t *testing.T, priv ed25519.PrivateKey, data []byte) (sha256hex, sigB64 string) {
	t.Helper()
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), base64.StdEncoding.EncodeToString(ed25519.Sign(priv, data))
}

// withPinnedKey swaps UpdatePublicKeyHex for the test's own key. It can't
// reassign the const, so tests that need a matching key patch the package
// var indirectly — here we just generate a key whose public half we write
// into the pinned slot via a small shim.
func TestVerifyBinary(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	orig := signingKeyHex
	signingKeyHex = hex.EncodeToString(pub)
	t.Cleanup(func() { signingKeyHex = orig })

	bin := []byte("this is a pretend agent.exe")
	shaHex, sig := signWith(t, priv, bin)

	if err := VerifyBinary(bin, shaHex, sig); err != nil {
		t.Fatalf("valid binary rejected: %v", err)
	}

	// Tampered bytes -> sha mismatch.
	if err := VerifyBinary(append(bin, '!'), shaHex, sig); !errors.Is(err, ErrIntegrity) {
		t.Fatalf("want ErrIntegrity for tampered bytes, got %v", err)
	}

	// Right bytes, wrong signature (signed by a different key).
	_, otherPriv, _ := ed25519.GenerateKey(nil)
	_, badSig := signWith(t, otherPriv, bin)
	if err := VerifyBinary(bin, shaHex, badSig); !errors.Is(err, ErrIntegrity) {
		t.Fatalf("want ErrIntegrity for foreign signature, got %v", err)
	}

	// Garbage signature encoding.
	if err := VerifyBinary(bin, shaHex, "not-base64!!"); !errors.Is(err, ErrIntegrity) {
		t.Fatalf("want ErrIntegrity for malformed signature, got %v", err)
	}
}
