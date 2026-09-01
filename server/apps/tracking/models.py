import uuid

from django.db import models

EVENT_TYPES = [
    "app_usage",
    "browser_domain",
    "screen_time_summary",
    "device_state",
    # Agent OTA lifecycle: emitted once when an update lands or is rolled back.
    "agent_updated",
    "agent_update_failed",
]

# app_icon events carry a small PNG the agent extracted from the app's exe.
# They aren't time-series data, so ingest folds them into DeviceAppIcon
# (one current icon per app) instead of storing an Event row per resend.
ICON_EVENT_TYPE = "app_icon"


class EventBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device = models.ForeignKey(
        "devices.ChildDevice", on_delete=models.CASCADE, related_name="batches"
    )
    batch_id = models.CharField(max_length=64, unique=True)
    received_at = models.DateTimeField(auto_now_add=True)


class Event(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(EventBatch, on_delete=models.CASCADE, related_name="events")
    device = models.ForeignKey(
        "devices.ChildDevice", on_delete=models.CASCADE, related_name="events"
    )
    event_type = models.CharField(max_length=30)
    payload = models.JSONField()
    occurred_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=["device", "event_type", "occurred_at"], name="event_device_type_time_idx"),
        ]


class DeviceAppIcon(models.Model):
    """The current icon for one app on one device.

    The agent extracts a 32x32 PNG from the foreground app's exe and sends it
    once (per app, per icon change). ``data_b64`` is the raw base64 payload
    without the data-URI prefix; the summary/history endpoints wrap it.
    """

    device = models.ForeignKey(
        "devices.ChildDevice", on_delete=models.CASCADE, related_name="app_icons"
    )
    app_id = models.CharField(max_length=200)
    sha256 = models.CharField(max_length=64)
    data_b64 = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["device", "app_id"], name="uniq_device_app_icon"),
        ]


class DailyDigestRun(models.Model):
    """One row per local date the Telegram daily digest has been sent for.
    PythonAnywhere Free has no scheduled tasks, so the digest is triggered by
    an external cron hitting an endpoint; this makes that safe to hit twice."""

    date = models.DateField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
