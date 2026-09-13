#!/usr/bin/env bash
# Hourly housekeeping: downgrade expired subscriptions promptly, clean up
# expired on-demand screenshots.
set -a
source /etc/spino24/env
set +a

BASE="http://127.0.0.1:8001"

curl -s -X POST "$BASE/api/billing/expire/" -H "X-Digest-Secret: $DIGEST_CRON_SECRET"
curl -s -X POST "$BASE/api/screenshots/cleanup/" -H "X-Digest-Secret: $DIGEST_CRON_SECRET"
