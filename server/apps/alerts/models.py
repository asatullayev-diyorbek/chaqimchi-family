import uuid

from django.db import models

ALERT_TYPES = ["limit_reached", "blocked_app_opened", "settings_panel_access"]

# Human labels, shared by the Telegram push and the notification-settings API.
ALERT_LABELS = {
    "limit_reached": "Ekran vaqti limiti tugadi",
    "blocked_app_opened": "Taqiqlangan ilova ochildi",
    "settings_panel_access": "Qurilmada «Kattalar uchun» paneli ochildi",
}


class Alert(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device = models.ForeignKey(
        "devices.ChildDevice", on_delete=models.CASCADE, related_name="alerts"
    )
    alert_type = models.CharField(max_length=30, choices=[(t, t) for t in ALERT_TYPES])
    payload = models.JSONField()
    triggered_at = models.DateTimeField()
    seen = models.BooleanField(default=False)


class NotificationPreference(models.Model):
    """One row per (parent, alert_type) the parent has turned OFF for
    Telegram. Absence of a row means "send it" — a new alert type notifies
    by default, and parents only ever store opt-outs."""

    parent = models.ForeignKey(
        "accounts.ParentUser", on_delete=models.CASCADE, related_name="notification_prefs"
    )
    alert_type = models.CharField(max_length=30)
    via_telegram = models.BooleanField(default=True)

    class Meta:
        unique_together = ("parent", "alert_type")
