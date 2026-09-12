from django.contrib import admin

from .models import Child, ChildDevice, EnrollmentCode, IconBlob, InstalledApp


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ("name", "family", "birth_date", "created_at")
    search_fields = ("name", "family__id")
    list_filter = ("created_at",)


@admin.register(ChildDevice)
class ChildDeviceAdmin(admin.ModelAdmin):
    list_display = (
        "id", "child_name", "family", "platform", "status",
        "agent_version", "last_sync", "linked_at", "geo_location_label",
    )
    list_filter = ("status", "platform", "geo_source")
    search_fields = ("id", "child_name", "hardware_id", "family__id")
    readonly_fields = ("id", "device_secret", "created_at")


@admin.register(InstalledApp)
class InstalledAppAdmin(admin.ModelAdmin):
    list_display = ("name", "device", "version", "publisher", "last_seen")
    search_fields = ("name", "device__id", "device__child_name")
    list_filter = ("publisher",)


@admin.register(EnrollmentCode)
class EnrollmentCodeAdmin(admin.ModelAdmin):
    list_display = ("code", "device", "used", "expires_at")
    list_filter = ("used",)
    search_fields = ("code", "device__id")


@admin.register(IconBlob)
class IconBlobAdmin(admin.ModelAdmin):
    # Content-addressed — read-only by design, one row is shared by however
    # many apps/devices reference the same icon bytes.
    list_display = ("sha256", "created_at")
    search_fields = ("sha256",)
    readonly_fields = ("sha256", "data_b64", "created_at")

    def has_add_permission(self, request):
        return False
