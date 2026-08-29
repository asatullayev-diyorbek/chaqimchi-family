package updater

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
)

// ErrIntegrity is returned when a downloaded binary fails sha256 or
// signature verification. The caller must discard the binary.
var ErrIntegrity = errors.New("update binary failed integrity check")

// signingKeyHex is the key VerifyBinary trusts. It is UpdatePublicKeyHex in
// production; tests point it at a key they hold the private half of.
var signingKeyHex = UpdatePublicKeyHex

// VerifyBinary checks that data matches sha256hex and carries a valid
// Ed25519 signature (sigB64) from the pinned update key. Both must pass.
func VerifyBinary(data []byte, sha256hex, sigB64 string) error {
	pub, err := hex.DecodeString(signingKeyHex)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return fmt.Errorf("%w: pinned public key is malformed", ErrIntegrity)
	}

	wantSum, err := hex.DecodeString(sha256hex)
	if err != nil || len(wantSum) != sha256.Size {
		return fmt.Errorf("%w: manifest sha256 is malformed", ErrIntegrity)
	}
	gotSum := sha256.Sum256(data)
	if subtle.ConstantTimeCompare(gotSum[:], wantSum) != 1 {
		return fmt.Errorf("%w: sha256 mismatch", ErrIntegrity)
	}

	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return fmt.Errorf("%w: signature is malformed", ErrIntegrity)
	}
	if !ed25519.Verify(ed25519.PublicKey(pub), data, sig) {
		return fmt.Errorf("%w: signature does not verify against the pinned key", ErrIntegrity)
	}
	return nil
}
