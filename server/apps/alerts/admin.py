from django.contrib import admin

from .models import Alert, NotificationPreference


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ("id", "device", "alert_type", "triggered_at", "seen")
    list_filter = ("alert_type", "seen")
    search_fields = ("id", "device__id", "device__child_name")
    date_hierarchy = "triggered_at"
    readonly_fields = ("id",)


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("parent", "alert_type", "via_telegram")
    list_filter = ("alert_type", "via_telegram")
