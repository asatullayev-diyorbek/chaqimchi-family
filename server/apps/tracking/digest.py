"""Small read helpers over tracking events, shared by the Telegram bot
commands and the daily digest. Kept separate from views.py so neither the
bot nor a management command has to import a DRF view module."""

from datetime import datetime, time, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.tracking.models import Event

ONLINE_THRESHOLD = timedelta(minutes=5)


def _event_minutes(payload):
    duration = payload.get("duration_seconds")
    if isinstance(duration, (int, float)) and duration >= 0:
        return duration / 60
    started = parse_datetime(payload.get("started_at") or "")
    ended = parse_datetime(payload.get("ended_at") or "")
    if started and ended and ended > started:
        return (ended - started).total_seconds() / 60
    return 0.0


def screen_minutes(device, on_date=None):
    """Total foreground minutes for a device on a local date (today by default)."""
    tz = timezone.get_current_timezone()
    day = on_date or timezone.localtime(timezone.now(), tz).date()
    start = timezone.make_aware(datetime.combine(day, time.min), tz)
    end = timezone.make_aware(datetime.combine(day, time.max), tz)
    total = 0.0
    for event in Event.objects.filter(
        device=device, event_type="app_usage",
        occurred_at__gte=start, occurred_at__lte=end,
    ).only("payload"):
        total += _event_minutes(event.payload or {})
    return round(total)


def device_state(device):
    """(online: bool, battery: int|None) from the freshest signals available."""
    online = bool(device.last_sync and timezone.now() - device.last_sync <= ONLINE_THRESHOLD)
    battery = None
    latest = (
        Event.objects.filter(device=device, event_type="device_state")
        .order_by("-occurred_at")
        .only("payload")
        .first()
    )
    if latest:
        raw = (latest.payload or {}).get("battery_percent")
        if isinstance(raw, (int, float)) and raw >= 0:
            battery = int(raw)
    return online, battery


def human_minutes(minutes):
    minutes = max(0, int(minutes))
    h, m = divmod(minutes, 60)
    if h and m:
        return f"{h} soat {m} daq"
    if h:
        return f"{h} soat"
    return f"{m} daq"


def build_family_digest(family, on_date):
    """Yesterday's per-child screen time + alert count for one family, or
    None when there was no activity at all (nothing to send)."""
    from datetime import datetime, time

    from apps.alerts.models import Alert
    from apps.devices.models import ChildDevice

    devices = list(
        ChildDevice.objects.filter(family=family, status=ChildDevice.STATUS_LINKED).select_related("child")
    )
    if not devices:
        return None

    per_child = {}
    for d in devices:
        who = (d.child.name if d.child else "") or d.child_name or "Qurilma"
        per_child[who] = per_child.get(who, 0) + screen_minutes(d, on_date)

    total = sum(per_child.values())

    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(on_date, time.min), tz)
    end = timezone.make_aware(datetime.combine(on_date, time.max), tz)
    alert_count = Alert.objects.filter(
        device__in=devices, triggered_at__gte=start, triggered_at__lte=end
    ).count()

    if total == 0 and alert_count == 0:
        return None

    lines = [f"📊 Kunlik hisobot — {on_date:%d.%m}", ""]
    for who, mins in sorted(per_child.items(), key=lambda kv: -kv[1]):
        lines.append(f"• {who}: {human_minutes(mins)}")
    if alert_count:
        lines.append("")
        lines.append(f"🔔 {alert_count} ta ogohlantirish")
    return "\n".join(lines)
