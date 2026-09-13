from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("parent", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = ("parent__email", "parent__telegram_username", "comment")
    readonly_fields = ("created_at",)
