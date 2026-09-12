from django.contrib import admin

from .models import WeeklyInsight


@admin.register(WeeklyInsight)
class WeeklyInsightAdmin(admin.ModelAdmin):
    list_display = ("child", "week_start", "risk_level", "created_at")
    list_filter = ("risk_level",)
    search_fields = ("child__name", "child__family__id")
    readonly_fields = ("created_at",)
