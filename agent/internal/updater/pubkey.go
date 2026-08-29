package updater

// UpdatePublicKeyHex is the Ed25519 public key the agent pins to verify OTA
// update binaries. The matching private key signs each release with
// `relsign sign` (see agent/cmd/relsign) and is stored only as a secret,
// never in this repo.
//
// SECURITY: this key was generated during development. Rotate it before any
// real public release — run `relsign genkey` privately, replace the value
// here, and keep the new private key in a secret manager. See
// docs/ota-update.md.
const UpdatePublicKeyHex = "26766ac507c13ba756a830547686460648eb23eec46dc90ff95cd503abf1c89c"
