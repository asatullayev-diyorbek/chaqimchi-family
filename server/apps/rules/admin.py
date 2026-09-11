from django.contrib import admin

from .models import Rule


@admin.register(Rule)
class RuleAdmin(admin.ModelAdmin):
    list_display = ("id", "device", "rule_type", "created_at")
    list_filter = ("rule_type",)
    search_fields = ("id", "device__id", "device__child_name")
