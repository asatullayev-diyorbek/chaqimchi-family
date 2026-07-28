import logging
from collections import defaultdict
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser
from apps.devices.models import ChildDevice

from .models import EVENT_TYPES, Event, EventBatch
from .serializers import IngestSerializer, SummarySerializer

logger = logging.getLogger(__name__)

# A device is considered "online" if it has synced within this window —
# there's no real-time push in this phase (that's deferred to the Alerts
# bosqich), so this is a heuristic based on last successful ingest contact.
ONLINE_THRESHOLD = timedelta(minutes=5)


def _occurred_at(event: dict):
    raw = event.get("occurred_at") or event.get("started_at")
    parsed = parse_datetime(raw) if raw else None
    return parsed or timezone.now()


class IngestView(APIView):
    """POST /api/tracking/ingest/ — called by the agent, device-secret authenticated."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        device = request.user
        if not isinstance(device, ChildDevice):
            return Response(
                {"detail": "Device autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = IngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if str(data["device_id"]) != str(device.id):
            return Response(
                {"detail": "device_id autentifikatsiya qilingan qurilmaga mos kelmaydi"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if device.status != ChildDevice.STATUS_LINKED:
            return Response(
                {"detail": "Qurilma hali oilaga bog'lanmagan"},
                status=status.HTTP_403_FORBIDDEN,
            )

        batch_id = data["batch_id"]

        # Any successful contact — even a duplicate resend — means the
        # device was reachable just now, so it drives device_status/last_sync
        # on the summary endpoint regardless of whether new rows are written.
        ChildDevice.objects.filter(id=device.id).update(last_sync=timezone.now())

        # Idempotency: a batch we've already stored is a no-op success —
        # the agent retries whenever it didn't see our ack, not just on error.
        if EventBatch.objects.filter(batch_id=batch_id).exists():
            return Response({"status": "ok", "duplicate": True})

        try:
            with transaction.atomic():
                batch = EventBatch.objects.create(device=device, batch_id=batch_id)
                created = 0
                skipped = 0
                for event in data["events"]:
                    event_type = event.get("type")
                    if event_type not in EVENT_TYPES:
                        logger.warning(
                            "Noma'lum event turi rad etildi: %s (device=%s, batch=%s)",
                            event_type,
                            device.id,
                            batch_id,
                        )
                        skipped += 1
                        continue
                    Event.objects.create(
                        batch=batch,
                        device=device,
                        event_type=event_type,
                        payload=event,
                        occurred_at=_occurred_at(event),
                    )
                    created += 1
        except IntegrityError:
            # Concurrent retry raced us and inserted the same batch_id first.
            return Response({"status": "ok", "duplicate": True})

        return Response(
            {"status": "ok", "events_saved": created, "events_skipped": skipped},
            status=status.HTTP_201_CREATED,
        )


RANGE_DAYS = {
    "day": 1,
    "week": 7,
    # A calendar month varies in length; "month" here is a trailing
    # 30-day window ending at the target date, not the actual calendar
    # month — simpler, and good enough for the desktop Faoliyat screen's
    # "oy" filter. Documented here since it's a real (small) semantic gap
    # from what "oy" literally implies.
    "month": 30,
}


def _app_minutes_for_date(device, target_date):
    """Returns (minutes_per_app: dict[str, float], total: float) for one day."""
    events = Event.objects.filter(
        device=device, event_type="app_usage", occurred_at__date=target_date
    )
    minutes_per_app = defaultdict(float)
    for event in events:
        payload = event.payload or {}
        started = parse_datetime(payload.get("started_at") or "")
        ended = parse_datetime(payload.get("ended_at") or "")
        if started and ended and ended > started:
            app = payload.get("app", "unknown")
            minutes_per_app[app] += (ended - started).total_seconds() / 60
    return minutes_per_app, sum(minutes_per_app.values())


class SummaryView(APIView):
    """GET /api/tracking/summary/<device_id>/?date=YYYY-MM-DD&range=day|week|month
    — parent-authenticated.

    range defaults to "day" — the exact single-day shape Bosqich 2 shipped
    and parent-mobile already relies on is unchanged (same fields, same
    values) when range is omitted. range=week/month only adds a
    `breakdown` field on top; nothing existing is removed or renamed.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, device_id):
        if not isinstance(request.user, ParentUser):
            return Response(
                {"detail": "Parent autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        device = get_object_or_404(ChildDevice, id=device_id)
        if device.family_id != request.user.family_id:
            return Response(
                {"detail": "Bu qurilma sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )

        date_param = request.query_params.get("date")
        if date_param:
            target_date = parse_date(date_param)
            if target_date is None:
                return Response(
                    {"detail": "Noto'g'ri sana formati (YYYY-MM-DD kerak)"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = timezone.now().date()

        range_param = request.query_params.get("range", "day")
        if range_param not in RANGE_DAYS:
            return Response(
                {"detail": "range 'day', 'week' yoki 'month' bo'lishi kerak"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        num_days = RANGE_DAYS[range_param]
        dates = [target_date - timedelta(days=offset) for offset in range(num_days - 1, -1, -1)]

        combined_minutes_per_app = defaultdict(float)
        breakdown = []
        for day in dates:
            minutes_per_app, day_total = _app_minutes_for_date(device, day)
            for app, minutes in minutes_per_app.items():
                combined_minutes_per_app[app] += minutes
            breakdown.append({"date": day, "total_minutes": round(day_total)})

        top_apps = sorted(
            (
                {"app": app, "minutes": round(minutes)}
                for app, minutes in combined_minutes_per_app.items()
            ),
            key=lambda entry: entry["minutes"],
            reverse=True,
        )
        total_screen_minutes = round(sum(combined_minutes_per_app.values()))

        if device.last_sync and timezone.now() - device.last_sync <= ONLINE_THRESHOLD:
            device_status = "online"
        else:
            device_status = "offline"

        data = SummarySerializer(
            {
                "device_id": device.id,
                "date": target_date,
                "total_screen_minutes": total_screen_minutes,
                "top_apps": top_apps,
                "device_status": device_status,
                "last_sync": device.last_sync,
                "breakdown": breakdown,
            }
        ).data
        return Response(data)
