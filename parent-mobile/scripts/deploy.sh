#!/usr/bin/env bash
# Deploy the Spino24 parent Mini App to production.
#
# `vercel deploy --prod` builds, promotes, and aliases both
# spino24-parent.vercel.app and spino24.chaqimchi-ai.uz to the new
# deployment. If the custom domain lags, re-run:
#   npx vercel alias set <deployment-url> spino24.chaqimchi-ai.uz --scope team_Y9KjerAJKfadhHKlOG24JhuS
set -euo pipefail

SCOPE="team_Y9KjerAJKfadhHKlOG24JhuS"
cd "$(dirname "$0")/.."

npx vercel deploy --prod --yes --scope "$SCOPE"

echo
echo "Verifying…"
for url in https://spino24-parent.vercel.app https://spino24.chaqimchi-ai.uz; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 \
    --resolve spino24.chaqimchi-ai.uz:443:76.76.21.21 "$url/" || true)
  echo "  $url -> ${code:-fail}"
done
