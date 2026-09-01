"""Parent-facing fan-out for alerts.

The dashboard already lists every alert; this module additionally pushes the
high-signal ones to Telegram for parents who logged in that way. Best-effort:
a Telegram failure must never fail the agent's alert report.
"""

import logging

from apps.accounts.models import ParentUser
from apps.accounts.telegram import send_text

logger = logging.getLogger(__name__)

# Human labels for the Telegram message (the dashboard has its own).
ALERT_LABELS = {
    "limit_reached": "Bugungi ekran vaqti limiti tugadi",
    "blocked_app_opened": "Taqiqlangan ilova ochildi",
    "settings_panel_access": "Qurilmada «Kattalar uchun» paneli ochildi",
}

# Only these are worth a push notification; the rest live on the dashboard.
TELEGRAM_ALERT_TYPES = {"settings_panel_access"}


def notify_parents_of_alert(alert):
    if alert.alert_type not in TELEGRAM_ALERT_TYPES:
        return

    device = alert.device
    family_id = getattr(device, "family_id", None)
    if not family_id:
        return

    label = ALERT_LABELS.get(alert.alert_type, alert.alert_type)
    who = device.child_name or (device.child.name if device.child else "") or "Qurilma"
    text = (
        "🔔 ChaqimchiAI Guard\n\n"
        f"{label}\n"
        f"Qurilma: {who}\n"
        f"Vaqt: {alert.triggered_at:%Y-%m-%d %H:%M}"
    )

    parents = ParentUser.objects.filter(
        family_id=family_id, telegram_id__isnull=False
    )
    for parent in parents:
        try:
            send_text(parent.telegram_id, text)
        except Exception:  # noqa: BLE001 - best effort, never break the report
            logger.exception("telegram alert push failed for parent %s", parent.pk)
