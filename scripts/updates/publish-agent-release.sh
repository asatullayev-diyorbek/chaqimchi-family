#!/usr/bin/env bash
# Build, sign, and publish an agent OTA release.
#
#   scripts/updates/publish-agent-release.sh 0.5.0
#
# Needs: Go, `gh` (authenticated), and the Ed25519 signing private key at
# agent/.secrets/update-signing.key (or $RELSIGN_KEY). After this runs, add
# an AgentVersion row in Django admin with the version, the printed asset
# URL, and the printed sha256 + signature.
set -euo pipefail

VERSION="${1:?usage: publish-agent-release.sh <version>   e.g. 0.5.0}"
REPO="${GH_REPO:-asatullayev-diyorbek/chaqimchi-family}"
ROOT="$(git rev-parse --show-toplevel)"
KEY="${RELSIGN_KEY:-$ROOT/agent/.secrets/update-signing.key}"
TAG="agent-v$VERSION"
ASSET_NAME="chaqimchi-agent.exe"
# Build to the exact asset name so the GitHub download URL is predictable
# (the AgentVersion.binary_url below must match it byte-for-byte).
OUT="$ROOT/agent/build/$ASSET_NAME"

[ -f "$KEY" ] || { echo "signing key not found: $KEY" >&2; exit 1; }

echo "==> building $ASSET_NAME for $VERSION (windows/amd64)"
mkdir -p "$ROOT/agent/build"
( cd "$ROOT/agent" && GOOS=windows GOARCH=amd64 go build -trimpath \
    -ldflags "-H=windowsgui -X main.version=$VERSION" -o "$OUT" ./cmd/agent )
echo "    $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"

echo "==> signing"
( cd "$ROOT/agent" && go run ./cmd/relsign sign -key "$KEY" -bin "$OUT" -version "$VERSION" )

echo "==> publishing GitHub release $TAG"
gh release create "$TAG" "$OUT" \
  --repo "$REPO" --title "Agent $VERSION" \
  --notes "Agent OTA build $VERSION. Verified by the agent against the pinned Ed25519 key before install."

DOWNLOAD_URL="https://github.com/$REPO/releases/download/$TAG/$ASSET_NAME"
echo
echo "===================================================================="
echo "AgentVersion row to add in Django admin (/admin/deploy/agentversion/):"
echo "  version    : $VERSION"
echo "  binary_url : $DOWNLOAD_URL"
echo "  sha256     : (from the 'sha256' line above)"
echo "  signature  : (from the 'signature' line above)"
echo "  is_active  : yes"
echo "===================================================================="
echo "Roll out to ONE test device first; confirm it reports agent_version=$VERSION"
echo "on the dashboard before leaving is_active on for everyone."
