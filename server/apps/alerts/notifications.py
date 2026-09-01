"""Parent-facing fan-out for alerts.

The dashboard lists every alert; this module additionally pushes them to
Telegram for parents who linked their account, honouring each parent's
per-alert-type opt-outs (NotificationPreference). Best-effort: a Telegram
failure must never fail the agent's alert report.
"""

import logging

from django.conf import settings
from django.utils import timezone

from apps.accounts.models import ParentUser
from apps.accounts.telegram import send_text

from .models import ALERT_LABELS, NotificationPreference

logger = logging.getLogger(__name__)

# Every alert type is pushable; parents opt out per type in settings.
TELEGRAM_ALERT_TYPES = set(ALERT_LABELS)

_DASHBOARD_URL = getattr(settings, "PARENT_WEB_URL", "https://guard.chaqimchi-ai.uz")


def _message(alert):
    device = alert.device
    who = device.child_name or (device.child.name if device.child else "") or "Qurilma"
    label = ALERT_LABELS.get(alert.alert_type, alert.alert_type)
    lines = ["🔔 ChaqimchiAI Guard", "", label, f"Farzand: {who}"]
    app = (alert.payload or {}).get("app")
    if alert.alert_type == "blocked_app_opened" and app:
        lines.append(f"Ilova: {app}")
    lines.append(f"Vaqt: {timezone.localtime(alert.triggered_at):%Y-%m-%d %H:%M}")
    lines.append("")
    lines.append(f"{_DASHBOARD_URL}/alerts?device={device.id}")
    return "\n".join(lines)


def notify_parents_of_alert(alert):
    if alert.alert_type not in TELEGRAM_ALERT_TYPES:
        return

    family_id = getattr(alert.device, "family_id", None)
    if not family_id:
        return

    opted_out = set(
        NotificationPreference.objects.filter(
            alert_type=alert.alert_type,
            via_telegram=False,
            parent__family_id=family_id,
        ).values_list("parent_id", flat=True)
    )

    text = _message(alert)
    parents = ParentUser.objects.filter(family_id=family_id, telegram_id__isnull=False)
    for parent in parents:
        if parent.id in opted_out:
            continue
        try:
            send_text(parent.telegram_id, text)
        except Exception:  # noqa: BLE001 - best effort, never break the report
            logger.exception("telegram alert push failed for parent %s", parent.pk)
