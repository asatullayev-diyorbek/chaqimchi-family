from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser
from apps.devices.models import Child

from . import groq
from .serializers import WeeklyInsightSerializer
from .service import get_or_generate_weekly_insight


class ChildInsightView(APIView):
    """GET /api/insights/<child_id>/?refresh=1 — parent-authenticated,
    tenant-isolated, gated on the family's plan allowing ai_analysis."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, child_id):
        if not isinstance(request.user, ParentUser):
            return Response(
                {"detail": "Parent autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        child = get_object_or_404(Child, id=child_id)
        if child.family_id != request.user.family_id:
            return Response(
                {"detail": "Bu farzand sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )
        sub = request.user.family.subscription
        if not sub.allows("ai_analysis"):
            return Response(
                {"detail": "AI tahlil faqat Max tarifida mavjud", "upgrade_required": True},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not groq.is_configured():
            return Response(
                {"detail": "AI tahlil hozircha ulanmagan"}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        force = request.query_params.get("refresh") in ("1", "true")
        insight = get_or_generate_weekly_insight(child, force=force)
        if insight is None:
            return Response(
                {"detail": "Hozircha tahlil uchun yetarli ma'lumot yo'q"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(WeeklyInsightSerializer(insight).data)


class WeeklyRunView(APIView):
    """POST /api/insights/weekly-run/ — external cron (X-Digest-Secret, same
    shared secret as the daily digest). Generates and DMs this week's
    insight to every Max/Tester family's Telegram-linked parents."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get("X-Digest-Secret", "") or request.query_params.get("secret", "")
        if not settings.DIGEST_CRON_SECRET or secret != settings.DIGEST_CRON_SECRET:
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        from apps.accounts.models import Family, Subscription
        from apps.accounts.telegram import send_text
        from apps.alerts.models import NotificationPreference

        from .format import format_insight_message

        sent = 0
        families = Family.objects.filter(
            subscription__plan__in=(Subscription.PLAN_MAX, Subscription.PLAN_TESTER),
            parents__telegram_id__isnull=False,
        ).distinct()
        for family in families:
            parents = ParentUser.objects.filter(family=family, telegram_id__isnull=False)
            opted_out = set(
                NotificationPreference.objects.filter(
                    parent__in=parents, alert_type="weekly_insight", via_telegram=False
                ).values_list("parent_id", flat=True)
            )
            if len(opted_out) == parents.count():
                continue
            for child in Child.objects.filter(family=family):
                insight = get_or_generate_weekly_insight(child)
                if insight is None:
                    continue
                text = format_insight_message(child.name, insight)
                for parent in parents:
                    if parent.id not in opted_out:
                        send_text(parent.telegram_id, text)
                        sent += 1
        return Response({"sent": sent})
