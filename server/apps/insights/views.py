from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser
from apps.devices.models import Child

from .aggregate import period_bounds, week_bounds, weekly_summary_for_child
from .models import WeeklyInsight
from .serializers import WeeklyInsightSerializer
from .service import get_cached_insight, store_insight

VALID_PERIODS = {p for p, _ in WeeklyInsight.PERIOD_CHOICES}


def _period_from_request(request):
    """The requested period, or (None, error_response) for an unknown one.
    Defaults to last_week so existing callers (the bot) that never pass
    ?period= keep getting exactly what they got before periods existed."""
    period = request.query_params.get("period") or request.data.get("period") or WeeklyInsight.PERIOD_LAST_WEEK
    if period not in VALID_PERIODS:
        return None, Response({"detail": "Noto'g'ri davr"}, status=status.HTTP_400_BAD_REQUEST)
    return period, None


def _owned_child(request, child_id):
    """(child, None) when the caller's family owns it and the plan allows
    ai_analysis, else (None, error_response)."""
    if not isinstance(request.user, ParentUser):
        return None, Response(
            {"detail": "Parent autentifikatsiyasi talab qilinadi"}, status=status.HTTP_401_UNAUTHORIZED
        )
    child = get_object_or_404(Child, id=child_id)
    if child.family_id != request.user.family_id:
        return None, Response(
            {"detail": "Bu farzand sizning oilangizga tegishli emas"}, status=status.HTTP_403_FORBIDDEN
        )
    if not request.user.family.subscription.allows("ai_analysis"):
        return None, Response(
            {"detail": "AI tahlil faqat Max tarifida mavjud", "upgrade_required": True},
            status=status.HTTP_403_FORBIDDEN,
        )
    return child, None


class ChildInsightView(APIView):
    """GET /api/insights/<child_id>/?period=last_week|this_week|today — the
    cached insight for that period, or 404 if none has been generated yet
    (the client should then call .../data/ and generate it itself — see
    apps/insights/service.py for why)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, child_id):
        child, error = _owned_child(request, child_id)
        if error:
            return error
        period, error = _period_from_request(request)
        if error:
            return error
        insight = get_cached_insight(child, period)
        if insight is None:
            return Response(
                {"detail": "Hozircha tahlil yo'q — generatsiya qiling"}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(WeeklyInsightSerializer(insight).data)


class ChildInsightDataView(APIView):
    """GET /api/insights/<child_id>/data/?period=last_week|this_week|today —
    the raw data bundle a client needs to generate an insight itself (via
    the Vercel relay). this_week/today are necessarily partial — the period
    isn't over — so the bundle carries is_partial for the prompt to say so."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, child_id):
        child, error = _owned_child(request, child_id)
        if error:
            return error
        period, error = _period_from_request(request)
        if error:
            return error
        _, range_start, range_end, is_partial = period_bounds(period)
        week_data = weekly_summary_for_child(child, range_start, range_end)
        if week_data is None:
            return Response(
                {"detail": "Hozircha tahlil uchun yetarli ma'lumot yo'q"}, status=status.HTTP_404_NOT_FOUND
            )
        week_data["period"] = period
        week_data["is_partial"] = is_partial
        return Response(week_data)


class ChildInsightSubmitView(APIView):
    """POST /api/insights/<child_id>/submit/ — the client stores its own
    on-demand generation result (body: {..result fields, period}). No
    Telegram push here; the parent is already looking at the result in the
    app."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, child_id):
        child, error = _owned_child(request, child_id)
        if error:
            return error
        period, error = _period_from_request(request)
        if error:
            return error
        insight = store_insight(child, request.data, period)
        if insight is None:
            return Response({"detail": "Noto'g'ri format"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WeeklyInsightSerializer(insight).data)


def _check_cron_secret(request) -> bool:
    secret = request.headers.get("X-Insights-Cron-Secret", "")
    return bool(settings.INSIGHTS_CRON_SECRET) and secret == settings.INSIGHTS_CRON_SECRET


class PendingBatchView(APIView):
    """GET /api/insights/pending-batch/ — Vercel's weekly cron route calls
    this to find every Max/Tester child still missing this week's insight,
    with the data bundle to generate it from. Always last_week — the
    proactive push is weekly by design; this_week/today are on-demand only."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not _check_cron_secret(request):
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        from apps.accounts.models import Subscription

        week_start, week_end = week_bounds()
        done_child_ids = set(
            WeeklyInsight.objects.filter(
                period=WeeklyInsight.PERIOD_LAST_WEEK, week_start=week_start
            ).values_list("child_id", flat=True)
        )

        pending = []
        children = Child.objects.filter(
            family__subscription__plan__in=(Subscription.PLAN_MAX, Subscription.PLAN_TESTER)
        ).exclude(id__in=done_child_ids)
        for child in children:
            week_data = weekly_summary_for_child(child, week_start, week_end)
            if week_data is not None:
                week_data["period"] = WeeklyInsight.PERIOD_LAST_WEEK
                week_data["is_partial"] = False
                pending.append({"child_id": str(child.id), "week_data": week_data})
        return Response({"pending": pending})


class CronSubmitView(APIView):
    """POST /api/insights/cron-submit/ — stores a Vercel-generated weekly
    insight (always last_week) and DMs it to the family's Telegram-linked,
    opted-in parents."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not _check_cron_secret(request):
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        child_id = request.data.get("child_id")
        result = request.data.get("result") or {}
        child = get_object_or_404(Child, id=child_id)
        insight = store_insight(child, result, WeeklyInsight.PERIOD_LAST_WEEK)
        if insight is None:
            return Response({"detail": "Noto'g'ri format"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.accounts.telegram import send_text
        from apps.alerts.models import NotificationPreference

        from .format import format_insight_message

        parents = ParentUser.objects.filter(family_id=child.family_id, telegram_id__isnull=False)
        opted_out = set(
            NotificationPreference.objects.filter(
                parent__in=parents, alert_type="weekly_insight", via_telegram=False
            ).values_list("parent_id", flat=True)
        )
        text = format_insight_message(child.name, insight)
        notified = 0
        for parent in parents:
            if parent.id not in opted_out:
                send_text(parent.telegram_id, text)
                notified += 1

        return Response({"notified": notified})
