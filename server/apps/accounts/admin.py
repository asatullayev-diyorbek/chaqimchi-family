from django.contrib import admin

from .models import Family, ParentUser, Subscription


@admin.register(ParentUser)
class ParentUserAdmin(admin.ModelAdmin):
    list_display = (
        "__str__", "telegram_username", "phone",
        "onboarding_required", "onboarding_reminders_sent", "created_at",
    )
    list_filter = ("onboarding_required", "is_staff")
    search_fields = ("email", "username", "telegram_username", "phone", "telegram_id")
    readonly_fields = ("created_at", "last_onboarding_reminder_at")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("family", "plan", "status", "started_at", "expires_at")
    list_filter = ("plan", "status")


admin.site.register(Family)
