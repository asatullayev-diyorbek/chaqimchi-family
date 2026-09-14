#!/usr/bin/env bash
# Pushes parent-web/public/downloads/*.exe and *.zip to the VPS's static
# download folder (nginx serves them directly — see deploy/nginx_spino24.conf's
# /downloads/ location). These binaries are committed to the repo by
# scripts/windows/build-guard-setup.ps1 but must live on the VPS too, since
# parent-web's own /download page links to apiguard.spino24.uz/downloads/...
# rather than serving them itself (Vercel's edge was slow from Uzbekistan).
#
# Safe to run any time — rsync only transfers files that actually changed.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
downloads_dir="$repo_root/parent-web/public/downloads"

if [ ! -d "$downloads_dir" ]; then
  exit 0
fi

shopt -s nullglob
files=("$downloads_dir"/*.exe "$downloads_dir"/*.zip)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  exit 0
fi

ssh spino24-vps "mkdir -p /opt/spino24/downloads"
rsync -avz --checksum "${files[@]}" spino24-vps:/opt/spino24/downloads/
ssh spino24-vps "chown spino24:spino24 /opt/spino24/downloads/*"

echo "Synced to VPS:"
for f in "${files[@]}"; do
  echo "  - $(basename "$f")"
done
