import uuid

from django.db import models

EVENT_TYPES = ["app_usage", "browser_domain", "screen_time_summary", "device_state"]


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
