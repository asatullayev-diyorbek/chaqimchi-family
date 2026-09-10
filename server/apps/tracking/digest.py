"""Small read helpers over tracking events, shared by the Telegram bot
commands and the daily digest. Kept separate from views.py so neither the
bot nor a management command has to import a DRF view module."""

from collections import defaultdict
from datetime import datetime, time, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.tracking.models import Event

ONLINE_THRESHOLD = timedelta(minutes=5)

# One foreground interval longer than this is a stalled poller (sleep, lock,
# session handoff), not real usage — cap it. Mirrors views.MAX_EVENT_MINUTES.
MAX_EVENT_MINUTES = 120


def _event_minutes(payload):
    duration = payload.get("duration_seconds")
    if isinstance(duration, (int, float)) and duration >= 0:
        return min(duration / 60, MAX_EVENT_MINUTES)
    started = parse_datetime(payload.get("started_at") or "")
    ended = parse_datetime(payload.get("ended_at") or "")
    if started and ended and ended > started:
        return min((ended - started).total_seconds() / 60, MAX_EVENT_MINUTES)
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


def screen_minutes_by_device(device_ids, on_date=None):
    """{device_id: rounded foreground minutes} for a local date, in one query."""
    return {k: v["minutes"] for k, v in today_usage_by_device(device_ids, on_date).items()}


def _app_name(payload):
    return (
        payload.get("app_name")
        or payload.get("app_id")
        or payload.get("app")
        or ""
    )


def today_usage_by_device(device_ids, on_date=None):
    """One Event scan → {device_id: {"minutes": int, "top_app": str,
    "top_minutes": int}} for a local date. Powers the bot's /bugun,
    /farzandlar and /qurilmalar."""
    device_ids = list(device_ids)
    if not device_ids:
        return {}
    tz = timezone.get_current_timezone()
    day = on_date or timezone.localtime(timezone.now(), tz).date()
    start = timezone.make_aware(datetime.combine(day, time.min), tz)
    end = timezone.make_aware(datetime.combine(day, time.max), tz)

    per_device = defaultdict(float)
    per_app = defaultdict(lambda: defaultdict(float))  # device -> app -> minutes
    for device_id, payload in Event.objects.filter(
        device_id__in=device_ids, event_type="app_usage",
        occurred_at__gte=start, occurred_at__lte=end,
    ).values_list("device_id", "payload"):
        payload = payload or {}
        mins = _event_minutes(payload)
        per_device[device_id] += mins
        name = _app_name(payload)
        if name:
            per_app[device_id][name] += mins

    out = {}
    for device_id in device_ids:
        apps = per_app.get(device_id) or {}
        top_app, top_min = ("", 0)
        if apps:
            top_app, raw = max(apps.items(), key=lambda kv: kv[1])
            top_min = round(raw)
        out[device_id] = {
            "minutes": round(per_device.get(device_id, 0)),
            "top_app": top_app,
            "top_minutes": top_min,
        }
    return out


def human_ago(dt):
    """'hozir' / '5 daqiqa oldin' / '3 soat oldin' / '2 kun oldin'."""
    if not dt:
        return "noma'lum"
    secs = (timezone.now() - dt).total_seconds()
    if secs < 90:
        return "hozirgina"
    mins = secs / 60
    if mins < 60:
        return f"{int(mins)} daqiqa oldin"
    hours = mins / 60
    if hours < 24:
        return f"{int(hours)} soat oldin"
    return f"{int(hours / 24)} kun oldin"


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


def run_daily_digest(for_date=None):
    """Send yesterday's digest to every linked, opted-in parent. Idempotent
    per date via DailyDigestRun, so it's safe to trigger from an external
    cron (PythonAnywhere Free has no scheduled tasks) or by hand. Returns
    (already_ran: bool, recipients: int)."""
    from datetime import timedelta

    from apps.accounts.models import Family, ParentUser
    from apps.accounts.telegram import send_text
    from apps.alerts.models import NotificationPreference

    from .models import DailyDigestRun

    day = for_date or (timezone.localtime(timezone.now()) - timedelta(days=1)).date()
    _, created = DailyDigestRun.objects.get_or_create(date=day)
    if not created:
        return True, 0

    sent = 0
    for family in Family.objects.filter(parents__telegram_id__isnull=False).distinct():
        text = build_family_digest(family, day)
        if not text:
            continue
        parents = ParentUser.objects.filter(family=family, telegram_id__isnull=False)
        opted_out = set(
            NotificationPreference.objects.filter(
                parent__in=parents, alert_type="daily_digest", via_telegram=False
            ).values_list("parent_id", flat=True)
        )
        for parent in parents:
            if parent.id not in opted_out:
                send_text(parent.telegram_id, text)
                sent += 1
    return False, sent


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
