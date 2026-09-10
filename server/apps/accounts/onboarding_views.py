"""POST /api/auth/onboarding/remind/ — nudges Telegram-origin parents who
created an account but never sent a phone number.

PythonAnywhere Free has no scheduled tasks, so an external cron (cron-job.org)
hits this with the shared digest secret, exactly like the daily digest.
"""

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .onboarding import run_onboarding_reminders


class OnboardingRemindView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get("X-Digest-Secret", "") or request.query_params.get("secret", "")
        if not settings.DIGEST_CRON_SECRET or secret != settings.DIGEST_CRON_SECRET:
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        return Response(run_onboarding_reminders())
