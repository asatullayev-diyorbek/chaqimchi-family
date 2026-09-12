"""Builds the 7-day per-child data bundle fed to Groq for a weekly AI
insight. Reuses the same event-parsing helpers the daily digest and the
Sites view already have (apps/tracking/digest.py, apps/tracking/views.py)
rather than re-deriving app-usage-minutes or domain-normalization logic."""

from collections import defaultdict
from datetime import datetime, time, timedelta

from django.utils import timezone

from apps.alerts.models import Alert
from apps.devices.models import ChildDevice
from apps.rules.models import Rule
from apps.tracking.digest import _app_name, _event_minutes
from apps.tracking.models import Event
from apps.tracking.views import _normalize_domain

MAX_TOP_APPS = 8
MAX_TOP_DOMAINS = 8


def week_bounds(today=None):
    """(monday, sunday) of the most recently completed week — i.e. if today
    is Wednesday, last Monday..Sunday, not the current in-progress week."""
    tz = timezone.get_current_timezone()
    day = today or timezone.localtime(timezone.now(), tz).date()
    this_monday = day - timedelta(days=day.weekday())
    last_monday = this_monday - timedelta(days=7)
    return last_monday, last_monday + timedelta(days=6)


def weekly_summary_for_child(child, week_start, week_end):
    """The data bundle for one child's week, or None if the child has no
    linked devices at all (nothing to analyze)."""
    device_ids = list(
        ChildDevice.objects.filter(child=child, status=ChildDevice.STATUS_LINKED).values_list(
            "id", flat=True
        )
    )
    if not device_ids:
        return None

    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(week_start, time.min), tz)
    end = timezone.make_aware(datetime.combine(week_end, time.max), tz)

    daily_minutes = defaultdict(float)
    app_minutes = defaultdict(float)
    domain_visits = defaultdict(int)

    for event_type, occurred_at, payload in Event.objects.filter(
        device_id__in=device_ids,
        event_type__in=("app_usage", "browser_domain"),
        occurred_at__gte=start,
        occurred_at__lte=end,
    ).values_list("event_type", "occurred_at", "payload"):
        payload = payload or {}
        if event_type == "app_usage":
            mins = _event_minutes(payload)
            daily_minutes[timezone.localtime(occurred_at, tz).date()] += mins
            name = _app_name(payload)
            if name:
                app_minutes[name] += mins
        else:
            domain = _normalize_domain(payload)
            if domain:
                domain_visits[domain] += 1

    alert_counts = defaultdict(int)
    for alert_type in Alert.objects.filter(
        device_id__in=device_ids, triggered_at__gte=start, triggered_at__lte=end
    ).values_list("alert_type", flat=True):
        alert_counts[alert_type] += 1

    rules = [
        {"rule_type": r["rule_type"], "value": r["value"]}
        for r in Rule.objects.filter(device_id__in=device_ids).values("rule_type", "value")
    ]

    top_apps = sorted(app_minutes.items(), key=lambda kv: -kv[1])[:MAX_TOP_APPS]
    top_domains = sorted(domain_visits.items(), key=lambda kv: -kv[1])[:MAX_TOP_DOMAINS]

    return {
        "child_name": child.name,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "total_minutes": round(sum(daily_minutes.values())),
        "daily_minutes": {d.isoformat(): round(m) for d, m in sorted(daily_minutes.items())},
        "top_apps": [{"name": n, "minutes": round(m)} for n, m in top_apps],
        "top_domains": [{"domain": d, "visits": v} for d, v in top_domains],
        "alerts": dict(alert_counts),
        "rules": rules,
    }
