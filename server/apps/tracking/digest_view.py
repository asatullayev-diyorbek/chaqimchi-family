"""POST /api/tracking/digest/run/ — fires the daily Telegram digest.

PythonAnywhere Free has no scheduled tasks, so an external cron (e.g.
cron-job.org) hits this once a day with the shared secret. Idempotent per
date, so a retry or a double-hit is harmless."""

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .digest import run_daily_digest


class RunDailyDigestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get("X-Digest-Secret", "") or request.query_params.get("secret", "")
        if not settings.DIGEST_CRON_SECRET or secret != settings.DIGEST_CRON_SECRET:
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        already, sent = run_daily_digest()
        return Response({"already_sent": already, "recipients": sent})
