import uuid

from django.db import models

ALERT_TYPES = ["limit_reached", "blocked_app_opened"]


class Alert(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device = models.ForeignKey(
        "devices.ChildDevice", on_delete=models.CASCADE, related_name="alerts"
    )
    alert_type = models.CharField(max_length=30, choices=[(t, t) for t in ALERT_TYPES])
    payload = models.JSONField()
    triggered_at = models.DateTimeField()
    seen = models.BooleanField(default=False)
