import secrets
import uuid

from django.db import models

from apps.accounts.models import Family


class IconBlob(models.Model):
    """Content-addressed icon storage — one row per unique PNG regardless of
    how many apps/devices reference it. Icons repeat a lot (the same Chrome
    or Discord icon on every device that runs it); without this, each
    (device, app) row embedded its own full base64 copy of an icon that's
    often byte-for-byte identical to ten others already stored."""

    sha256 = models.CharField(max_length=64, primary_key=True)
    data_b64 = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def data_uri(self) -> str:
        return f"data:image/png;base64,{self.data_b64}"

    def __str__(self):
        return self.sha256[:12]


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
    # A stable per-machine fingerprint (SHA-256 of the Windows MachineGuid),
    # sent by the installer at generate-code time. Lets a re-install on the
    # same computer reuse its existing (unlinked) device row instead of
    # piling up an orphan every time. Blank for devices enrolled before this
    # field existed, or platforms that don't provide one.
    hardware_id = models.CharField(max_length=64, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    linked_at = models.DateTimeField(null=True, blank=True)
    last_sync = models.DateTimeField(null=True, blank=True)
    # Reported by the agent in each ingest batch's metadata; shown on the
    # dashboard so a parent can see what version is actually running.
    agent_version = models.CharField(max_length=20, blank=True)

    # Approximate location — "current status" like agent_version/last_sync,
    # not a history table. Two possible sources: an IP-geolocation lookup on
    # every ingest request ("ip", always available, city-level accuracy) or
    # the Windows Location API reported by the agent itself ("gps", more
    # precise, only available when the machine has location services on).
    # Whichever updated most recently wins — see IngestView / the location
    # event handler.
    GEO_SOURCE_IP = "ip"
    GEO_SOURCE_GPS = "gps"
    GEO_SOURCE_CHOICES = [(GEO_SOURCE_IP, "IP"), (GEO_SOURCE_GPS, "GPS")]

    last_ip = models.GenericIPAddressField(null=True, blank=True)
    geo_location_label = models.CharField(max_length=200, blank=True)
    geo_lat = models.FloatField(null=True, blank=True)
    geo_lng = models.FloatField(null=True, blank=True)
    geo_source = models.CharField(max_length=8, choices=GEO_SOURCE_CHOICES, blank=True)
    geo_updated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        name = self.child.name if self.child_id else (self.child_name or "Noma'lum qurilma")
        return f"{name} — {self.get_platform_display()}"


class InstalledApp(models.Model):
    """One row per (device, app) ever seen installed. The agent POSTs its
    full current list whenever it changes; the sync endpoint upserts each
    entry (clearing uninstalled_at if it reappears — a reinstall) and marks
    anything missing from the payload as uninstalled instead of deleting it,
    so a parent can still see what used to be there and when it went away."""

    device = models.ForeignKey(ChildDevice, on_delete=models.CASCADE, related_name="installed_apps")
    name = models.CharField(max_length=200)
    version = models.CharField(max_length=100, blank=True)
    publisher = models.CharField(max_length=200, blank=True)
    install_date = models.DateField(null=True, blank=True)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    uninstalled_at = models.DateTimeField(null=True, blank=True)
    icon = models.ForeignKey(IconBlob, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        unique_together = [("device", "name")]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} — {self.device}"


class EnrollmentCode(models.Model):
    device = models.ForeignKey(
        ChildDevice, on_delete=models.CASCADE, related_name="codes"
    )
    code = models.CharField(max_length=6, unique=True)
    qr_payload = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.code} — {self.device}"
