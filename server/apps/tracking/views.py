import base64
import binascii
import logging
from collections import defaultdict
from datetime import datetime, time, timedelta

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser
from apps.devices.models import ChildDevice

from .models import EVENT_TYPES, ICON_EVENT_TYPE, DeviceAppIcon, Event, EventBatch

# Guard against a malformed or hostile agent: a 32x32 PNG is ~1-3 KB, so a
# base64 payload over this is never a legitimate app icon.
MAX_ICON_B64_LEN = 96 * 1024
from .serializers import ActivityHistorySerializer, IngestSerializer, SummarySerializer

logger = logging.getLogger(__name__)

# A device is considered "online" if it has synced within this window —
# there's no real-time push in this phase (that's deferred to the Alerts
# bosqich), so this is a heuristic based on last successful ingest contact.
ONLINE_THRESHOLD = timedelta(minutes=5)


def _day_bounds(first_date, last_date):
    """Aware [start, end] datetimes spanning first_date..last_date inclusive.

    Filtering on a datetime range lets SQLite use the
    (device, event_type, occurred_at) index; an ``occurred_at__date`` lookup
    wraps every row in a date() call and forces a full scan.
    """
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(first_date, time.min), tz)
    end = timezone.make_aware(datetime.combine(last_date, time.max), tz)
    return start, end


def _store_app_icon(device, event: dict) -> bool:
    """Upsert one DeviceAppIcon from an app_icon event. Returns True on write."""
    app_id = (event.get("app_id") or event.get("app") or "").strip()
    sha256 = (event.get("sha256") or "").strip().lower()
    data_b64 = event.get("png_b64") or ""
    if not app_id or len(app_id) > 200:
        return False
    if len(sha256) != 64 or not all(c in "0123456789abcdef" for c in sha256):
        return False
    if not isinstance(data_b64, str) or not (0 < len(data_b64) <= MAX_ICON_B64_LEN):
        return False
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except (ValueError, binascii.Error):
        return False
    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return False

    existing = DeviceAppIcon.objects.filter(device=device, app_id=app_id).first()
    if existing and existing.sha256 == sha256:
        return False
    DeviceAppIcon.objects.update_or_create(
        device=device,
        app_id=app_id,
        defaults={"sha256": sha256, "data_b64": data_b64},
    )
    return True


def _icons_for_device(device, app_ids) -> dict:
    """Map app_id -> data URI for the given apps on this device."""
    rows = DeviceAppIcon.objects.filter(device=device, app_id__in=list(app_ids)).values_list(
        "app_id", "data_b64"
    )
    return {app_id: f"data:image/png;base64,{data}" for app_id, data in rows}


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
        sync_fields = {"last_sync": timezone.now()}
        reported_version = (data.get("agent") or {}).get("version") or ""
        if reported_version and reported_version != device.agent_version:
            sync_fields["agent_version"] = reported_version[:20]
        ChildDevice.objects.filter(id=device.id).update(**sync_fields)

        # Idempotency: a batch we've already stored is a no-op success —
        # the agent retries whenever it didn't see our ack, not just on error.
        if EventBatch.objects.filter(batch_id=batch_id).exists():
            return Response({"status": "ok", "batch_id": batch_id, "acknowledged": True, "duplicate": True})

        try:
            with transaction.atomic():
                batch = EventBatch.objects.create(device=device, batch_id=batch_id)
                created = 0
                skipped = 0
                icons_updated = 0
                for event in data["events"]:
                    event_type = event.get("type")
                    if event_type == ICON_EVENT_TYPE:
                        if _store_app_icon(device, event):
                            icons_updated += 1
                        else:
                            skipped += 1
                        continue
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
            return Response({"status": "ok", "batch_id": batch_id, "acknowledged": True, "duplicate": True})

        return Response(
            {
                "status": "ok",
                "batch_id": batch_id,
                "acknowledged": True,
                "events_saved": created,
                "events_skipped": skipped,
                "icons_updated": icons_updated,
            },
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

        # Fetch the whole requested range once. The previous implementation
        # performed one query per day plus one query per application for
        # last_used_at, which became expensive as the dashboard grew.
        combined_minutes_per_app = defaultdict(float)
        daily_minutes = defaultdict(float)
        last_used_at = {}
        range_start, range_end = _day_bounds(dates[0], target_date)
        current_tz = timezone.get_current_timezone()
        events = Event.objects.filter(
            device=device,
            event_type="app_usage",
            occurred_at__gte=range_start,
            occurred_at__lte=range_end,
        ).only("payload", "occurred_at")
        for event in events:
            payload = event.payload or {}
            app = payload.get("app_id") or payload.get("app") or "unknown"
            duration_seconds = payload.get("duration_seconds")
            if isinstance(duration_seconds, (int, float)) and duration_seconds >= 0:
                minutes = duration_seconds / 60
            else:
                started = parse_datetime(payload.get("started_at") or "")
                ended = parse_datetime(payload.get("ended_at") or "")
                minutes = (ended - started).total_seconds() / 60 if started and ended and ended > started else 0
            combined_minutes_per_app[app] += minutes
            daily_minutes[timezone.localtime(event.occurred_at, current_tz).date()] += minutes
            if app not in last_used_at or event.occurred_at > last_used_at[app]:
                last_used_at[app] = event.occurred_at

        breakdown = [{"date": day, "total_minutes": round(daily_minutes[day])} for day in dates]
        icons = _icons_for_device(device, combined_minutes_per_app.keys())
        top_apps = [
            {
                "app": app,
                "minutes": round(minutes),
                "last_used_at": last_used_at.get(app),
                "icon": icons.get(app),
            }
            for app, minutes in combined_minutes_per_app.items()
        ]
        top_apps.sort(key=lambda entry: entry["minutes"], reverse=True)
        total_screen_minutes = round(sum(combined_minutes_per_app.values()))

        if device.last_sync and timezone.now() - device.last_sync <= ONLINE_THRESHOLD:
            device_status = "online"
        else:
            device_status = "offline"

        # Latest known battery level from the agent's device_state events.
        # None means no battery / unavailable (desktop PC, or the agent
        # reported -1); the dashboard hides the battery UI in that case
        # instead of showing a fake "Noma'lum".
        battery_percent = None
        battery_at = None
        latest_state = (
            Event.objects.filter(device=device, event_type="device_state")
            .order_by("-occurred_at")
            .only("payload", "occurred_at")
            .first()
        )
        if latest_state:
            raw = (latest_state.payload or {}).get("battery_percent")
            if isinstance(raw, (int, float)) and raw >= 0:
                battery_percent = int(raw)
                battery_at = latest_state.occurred_at

        data = SummarySerializer(
            {
                "device_id": device.id,
                "child_name": device.child.name if device.child else "",
                "child_birth_date": device.child.birth_date if device.child else None,
                "child_photo_url": device.child.photo.url if device.child and device.child.photo else "",
                "date": target_date,
                "total_screen_minutes": total_screen_minutes,
                "top_apps": top_apps,
                "device_status": device_status,
                "last_sync": device.last_sync,
                "agent_version": device.agent_version or None,
                "battery_percent": battery_percent,
                "battery_updated_at": battery_at,
                "breakdown": breakdown,
            }
        ).data
        return Response(data)


class ActivityHistoryView(APIView):
    """GET /api/tracking/history/<device_id>/ — parent app-usage timeline."""

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

        try:
            limit = int(request.query_params.get("limit", 50))
            offset = int(request.query_params.get("offset", 0))
        except (TypeError, ValueError):
            return Response({"detail": "limit va offset son bo‘lishi kerak"}, status=status.HTTP_400_BAD_REQUEST)
        if limit < 1 or limit > 100:
            return Response({"detail": "limit 1 dan 100 gacha bo‘lishi kerak"}, status=status.HTTP_400_BAD_REQUEST)
        if offset < 0:
            return Response({"detail": "offset manfiy bo‘lishi mumkin emas"}, status=status.HTTP_400_BAD_REQUEST)

        queryset = Event.objects.filter(device=device, event_type="app_usage")
        date_param = request.query_params.get("date")
        if date_param:
            target_date = parse_date(date_param)
            if target_date is None:
                return Response({"detail": "Noto‘g‘ri sana formati (YYYY-MM-DD kerak)"}, status=status.HTTP_400_BAD_REQUEST)
            day_start, day_end = _day_bounds(target_date, target_date)
            queryset = queryset.filter(occurred_at__gte=day_start, occurred_at__lte=day_end)

        total = queryset.count()
        events = list(queryset.select_related("batch").order_by("-occurred_at", "-batch__received_at")[offset : offset + limit])
        icons = _icons_for_device(
            device,
            {(e.payload or {}).get("app_id") or (e.payload or {}).get("app") or "" for e in events},
        )
        results = []
        for event in events:
            payload = event.payload or {}
            duration = payload.get("duration_seconds")
            if not isinstance(duration, int) or duration < 0:
                duration = None
            app_id = payload.get("app_id") or payload.get("app") or ""
            results.append(
                {
                    "id": event.id,
                    "event_type": event.event_type,
                    "app_name": payload.get("app_name") or payload.get("app") or payload.get("app_id") or "",
                    "app_id": app_id,
                    "icon": icons.get(app_id),
                    "started_at": parse_datetime(payload.get("started_at") or "") if payload.get("started_at") else None,
                    "ended_at": parse_datetime(payload.get("ended_at") or "") if payload.get("ended_at") else None,
                    "duration_seconds": duration,
                    "created_at": event.batch.received_at,
                }
            )

        return Response(
            {
                "results": ActivityHistorySerializer(results, many=True).data,
                "count": total,
                "limit": limit,
                "offset": offset,
                "next_offset": offset + limit if offset + limit < total else None,
            }
        )


# Adjacent same-app segments closer than this are merged, so a 10s poll
# interval doesn't fragment one Chrome session into dozens of slivers.
TIMELINE_MERGE_GAP = timedelta(seconds=120)
TIMELINE_MAX_SEGMENTS = 800


class TimelineView(APIView):
    """GET /api/tracking/timeline/<device_id>/?date=YYYY-MM-DD

    One day's app_usage laid out on a 0..1440 minute axis (account
    timezone), coalesced, for the parent dashboard's time-of-day chart.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, device_id):
        if not isinstance(request.user, ParentUser):
            return Response({"detail": "Parent autentifikatsiyasi talab qilinadi"}, status=status.HTTP_401_UNAUTHORIZED)

        device = get_object_or_404(ChildDevice, id=device_id)
        if device.family_id != request.user.family_id:
            return Response({"detail": "Bu qurilma sizning oilangizga tegishli emas"}, status=status.HTTP_403_FORBIDDEN)

        tz = timezone.get_current_timezone()
        date_param = request.query_params.get("date")
        if date_param:
            target_date = parse_date(date_param)
            if target_date is None:
                return Response({"detail": "Noto'g'ri sana formati (YYYY-MM-DD kerak)"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            target_date = timezone.localtime(timezone.now(), tz).date()

        day_start, day_end = _day_bounds(target_date, target_date)
        events = Event.objects.filter(
            device=device, event_type="app_usage",
            occurred_at__gte=day_start, occurred_at__lte=day_end,
        ).only("payload", "occurred_at")

        raw = []
        for event in events:
            payload = event.payload or {}
            app_id = payload.get("app_id") or payload.get("app") or "unknown"
            start = parse_datetime(payload.get("started_at") or "")
            end = parse_datetime(payload.get("ended_at") or "")
            if not (start and end and end > start):
                dur = payload.get("duration_seconds")
                end = event.occurred_at
                start = end - timedelta(seconds=dur) if isinstance(dur, (int, float)) and dur > 0 else end
            start = max(start, day_start)
            end = min(end, day_end)
            if end <= start:
                continue
            raw.append((start, end, app_id, payload.get("app_name") or payload.get("app") or app_id))

        raw.sort(key=lambda s: s[0])
        merged = []
        for start, end, app_id, app_name in raw:
            if merged and merged[-1][2] == app_id and start - merged[-1][1] <= TIMELINE_MERGE_GAP:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end, app_id, app_name])
        merged = merged[:TIMELINE_MAX_SEGMENTS]

        icons = _icons_for_device(device, {m[2] for m in merged})
        midnight = day_start

        def minute_of(dt):
            return round((timezone.localtime(dt, tz) - timezone.localtime(midnight, tz)).total_seconds() / 60)

        segments = [
            {
                "app_id": app_id,
                "app_name": app_name,
                "icon": icons.get(app_id),
                "start_minute": max(0, minute_of(start)),
                "end_minute": min(1440, minute_of(end)),
                "duration_seconds": int((end - start).total_seconds()),
            }
            for start, end, app_id, app_name in merged
        ]
        return Response({"date": target_date, "segments": [s for s in segments if s["end_minute"] > s["start_minute"]]})
