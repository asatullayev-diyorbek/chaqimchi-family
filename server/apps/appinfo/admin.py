from django.contrib import admin

from .models import AppInfo


@admin.register(AppInfo)
class AppInfoAdmin(admin.ModelAdmin):
    list_display = ("display_name", "key", "category", "created_at")
    search_fields = ("key", "display_name")
    readonly_fields = ("created_at",)
