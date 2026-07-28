import secrets
import uuid

from django.db import models

from apps.accounts.models import Family


class ChildDevice(models.Model):
    STATUS_UNLINKED = "unlinked"
    STATUS_LINKED = "linked"
    STATUS_CHOICES = [
        (STATUS_UNLINKED, "Unlinked"),
        (STATUS_LINKED, "Linked"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    family = models.ForeignKey(
        Family, on_delete=models.CASCADE, related_name="devices", null=True, blank=True
    )
    child_name = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_UNLINKED
    )
    device_secret = models.CharField(max_length=255, default=secrets.token_hex)
    created_at = models.DateTimeField(auto_now_add=True)
    linked_at = models.DateTimeField(null=True, blank=True)
    last_sync = models.DateTimeField(null=True, blank=True)


class EnrollmentCode(models.Model):
    device = models.ForeignKey(
        ChildDevice, on_delete=models.CASCADE, related_name="codes"
    )
    code = models.CharField(max_length=6, unique=True)
    qr_payload = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
