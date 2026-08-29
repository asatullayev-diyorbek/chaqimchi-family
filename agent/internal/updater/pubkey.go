package updater

// UpdatePublicKeyHex is the Ed25519 public key the agent pins to verify OTA
// update binaries. The matching private key signs each release with
// `relsign sign` (see agent/cmd/relsign) and is stored only as a secret,
// never in this repo.
//
// Rotated 2026-08-30 with `relsign rotate`, which writes the private half
// straight to the gitignored secret file without printing it. The key it
// replaced had been generated inside a session transcript and so had to be
// treated as exposed.
//
// Rotating again strands every agent still pinned to this value: they can
// only reach a newer key through a release signed with the one they already
// trust. Do it deliberately, and see docs/ota-update.md first.
const UpdatePublicKeyHex = "fcdbbef0f231ccf573935e535da8ab3b975d8f4f67019349b3d36caaf9cde528"
