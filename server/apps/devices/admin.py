from django.contrib import admin

from .models import Child, ChildDevice, EnrollmentCode


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ("name", "family", "birth_date", "created_at")
    search_fields = ("name", "family__id")
    list_filter = ("created_at",)


@admin.register(ChildDevice)
class ChildDeviceAdmin(admin.ModelAdmin):
    list_display = (
        "id", "child_name", "family", "platform", "status",
        "agent_version", "last_sync", "linked_at",
    )
    list_filter = ("status", "platform")
    search_fields = ("id", "child_name", "hardware_id", "family__id")
    readonly_fields = ("id", "device_secret", "created_at")


@admin.register(EnrollmentCode)
class EnrollmentCodeAdmin(admin.ModelAdmin):
    list_display = ("code", "device", "used", "expires_at")
    list_filter = ("used",)
    search_fields = ("code", "device__id")
