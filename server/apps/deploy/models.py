import uuid

from django.db import models


class AgentVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.CharField(max_length=20)  # semver, e.g. "0.4.0"
    binary_url = models.URLField(max_length=500)  # GitHub release asset URL
    # Integrity: the agent verifies both before swapping the binary. sha256
    # is the lowercase-hex digest of the exact .exe bytes; signature is the
    # base64 Ed25519 signature over those bytes (from `relsign sign`).
    sha256 = models.CharField(max_length=64, blank=True)
    signature = models.TextField(blank=True)
    mandatory = models.BooleanField(default=False)  # advisory: flags a security update
    released_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-released_at"]

    def __str__(self):
        return f"agent {self.version}" + ("" if self.is_active else " (inactive)")
