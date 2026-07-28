import uuid

from django.db import models


class AgentVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.CharField(max_length=20)  # semver, e.g. "0.4.0"
    binary_url = models.URLField()
    released_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
