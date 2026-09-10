from django.contrib import admin

from .models import ScreenshotCleanupRun, ScreenshotRequest


@admin.register(ScreenshotRequest)
class ScreenshotRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "device", "status", "retention", "created_at", "captured_at", "expires_at")
    list_filter = ("status", "retention")
    readonly_fields = [f.name for f in ScreenshotRequest._meta.fields]
    search_fields = ("id", "device__id")


@admin.register(ScreenshotCleanupRun)
class ScreenshotCleanupRunAdmin(admin.ModelAdmin):
    list_display = ("ran_at", "expired_count", "unclaimed_count", "objects_deleted")
