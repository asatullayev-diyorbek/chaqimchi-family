import uuid

from django.db import models

RULE_TYPES = ["daily_limit_minutes", "blocked_app", "blocked_window"]


class Rule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device = models.ForeignKey(
        "devices.ChildDevice", on_delete=models.CASCADE, related_name="rules"
    )
    rule_type = models.CharField(max_length=30, choices=[(t, t) for t in RULE_TYPES])
    value = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
