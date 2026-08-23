import secrets
import uuid

from django.db import models

from apps.accounts.models import Family


class Child(models.Model):
    """A child belongs to one family and can own multiple devices."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    family = models.ForeignKey(Family, on_delete=models.CASCADE, related_name="children")
    name = models.CharField(max_length=100)
    birth_date = models.DateField(null=True, blank=True)
    photo = models.FileField(upload_to="children/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ChildDevice(models.Model):
    STATUS_UNLINKED = "unlinked"
    STATUS_LINKED = "linked"
    STATUS_CHOICES = [
        (STATUS_UNLINKED, "Unlinked"),
        (STATUS_LINKED, "Linked"),
    ]
    PLATFORM_WINDOWS = "windows"
    PLATFORM_ANDROID = "android"
    PLATFORM_IOS = "ios"
    PLATFORM_CHOICES = [(PLATFORM_WINDOWS, "Windows"), (PLATFORM_ANDROID, "Android"), (PLATFORM_IOS, "iOS")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    family = models.ForeignKey(
        Family, on_delete=models.CASCADE, related_name="devices", null=True, blank=True
    )
    child = models.ForeignKey(Child, on_delete=models.SET_NULL, related_name="devices", null=True, blank=True)
    child_name = models.CharField(max_length=100, blank=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default=PLATFORM_WINDOWS)
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
