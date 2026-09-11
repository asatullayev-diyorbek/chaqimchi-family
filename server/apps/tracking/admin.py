from django.contrib import admin

from .models import DailyDigestRun, DeviceAppIcon, Event, EventBatch


@admin.register(EventBatch)
class EventBatchAdmin(admin.ModelAdmin):
    list_display = ("batch_id", "device", "received_at")
    search_fields = ("batch_id", "device__id")
    date_hierarchy = "received_at"


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    # This table grows fast (an event per foreground poll) — read-only,
    # date-filtered, no full-table search on the JSON payload.
    list_display = ("id", "device", "event_type", "occurred_at")
    list_filter = ("event_type",)
    search_fields = ("device__id",)
    date_hierarchy = "occurred_at"
    readonly_fields = ("id", "batch", "device", "event_type", "payload", "occurred_at")

    def has_add_permission(self, request):
        return False


@admin.register(DeviceAppIcon)
class DeviceAppIconAdmin(admin.ModelAdmin):
    list_display = ("device", "app_id", "updated_at")
    search_fields = ("device__id", "app_id")


@admin.register(DailyDigestRun)
class DailyDigestRunAdmin(admin.ModelAdmin):
    list_display = ("date", "created_at")
