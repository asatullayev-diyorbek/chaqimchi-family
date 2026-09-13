#!/usr/bin/env bash
# Once-a-day jobs — replaces PythonAnywhere Free's external cron-job.org
# triggers for these two now that a real crontab is available.
set -a
source /etc/spino24/env
set +a

BASE="http://127.0.0.1:8001"

curl -s -X POST "$BASE/api/tracking/digest/run/" -H "X-Digest-Secret: $DIGEST_CRON_SECRET"
curl -s -X POST "$BASE/api/auth/onboarding/remind/" -H "X-Digest-Secret: $DIGEST_CRON_SECRET"
