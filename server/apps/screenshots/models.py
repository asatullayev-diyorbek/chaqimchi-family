import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone


class ScreenshotRequest(models.Model):
    """One "take a screenshot now" request a parent fired at one device.

    Spino24 has no realtime push (PythonAnywhere Free is WSGI-only), so the
    flow is a command queue: the parent creates a row here, the agent polls
    /api/screenshots/pending/, captures the screen in the child's session,
    PUTs the JPEG straight to Cloudflare R2 with a presigned URL, then
    confirms. Retention is the parent's choice at request time; a daily cron
    deletes the R2 object and this row once ``expires_at`` passes.
    """

    # retention choice -> how many days the captured image is kept
    RETENTION_DAYS = {"day": 1, "week": 7, "month": 30}
    RETENTION_CHOICES = [
        ("day", "1 kun"),
        ("week", "1 hafta"),
        ("month", "1 oy"),
    ]

    STATUS_PENDING = "pending"      # queued, waiting for the agent to pick it up
    STATUS_CAPTURING = "capturing"  # agent got a presigned URL, upload in flight
    STATUS_UPLOADED = "uploaded"    # image is in R2 and viewable
    STATUS_FAILED = "failed"        # agent reported it couldn't capture / upload
    STATUS_EXPIRED = "expired"      # retention window passed (image deleted) or the
                                    # request sat unclaimed too long (device offline)
    STATUS_CHOICES = [
        (STATUS_PENDING, "Kutilmoqda"),
        (STATUS_CAPTURING, "Olinmoqda"),
        (STATUS_UPLOADED, "Tayyor"),
        (STATUS_FAILED, "Xatolik"),
        (STATUS_EXPIRED, "Muddati tugagan"),
    ]

    # A request the agent never claimed (device was offline the whole time)
    # is expired by the cleanup job after this long, so the parent's UI stops
    # showing a forever-spinning "kutilmoqda" card.
    UNCLAIMED_TTL = timedelta(hours=2)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device = models.ForeignKey(
        "devices.ChildDevice", on_delete=models.CASCADE, related_name="screenshot_requests"
    )
    # Who asked — kept for the audit trail even if that parent later leaves
    # the family, hence SET_NULL rather than CASCADE.
    requested_by = models.ForeignKey(
        "accounts.ParentUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="screenshot_requests",
    )
    retention = models.CharField(max_length=10, choices=RETENTION_CHOICES, default="week")
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    error = models.CharField(max_length=300, blank=True)

    r2_key = models.CharField(max_length=200, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    sha256 = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["device", "status"], name="shot_device_status_idx"),
        ]

    def storage_key(self) -> str:
        return f"screenshots/{self.device_id}/{self.id}.jpg"

    def retention_delta(self) -> timedelta:
        return timedelta(days=self.RETENTION_DAYS.get(self.retention, 7))

    def mark_uploaded(self, *, captured_at, width, height, size_bytes, sha256):
        self.status = self.STATUS_UPLOADED
        self.captured_at = captured_at or timezone.now()
        self.width = width or None
        self.height = height or None
        self.size_bytes = size_bytes or None
        self.sha256 = (sha256 or "")[:64]
        self.expires_at = self.captured_at + self.retention_delta()
        self.save(
            update_fields=[
                "status", "captured_at", "width", "height",
                "size_bytes", "sha256", "expires_at",
            ]
        )


class ScreenshotCleanupRun(models.Model):
    """Audit row per cleanup-cron invocation (see views.CleanupView)."""

    ran_at = models.DateTimeField(auto_now_add=True)
    expired_count = models.PositiveIntegerField(default=0)
    unclaimed_count = models.PositiveIntegerField(default=0)
    objects_deleted = models.PositiveIntegerField(default=0)
