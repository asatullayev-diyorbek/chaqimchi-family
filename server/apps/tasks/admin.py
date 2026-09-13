from django.contrib import admin

from .models import Task, TaskCompletion, Wallet, WalletTransaction


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "reward_uzs", "is_active", "channel_username")
    list_filter = ("type", "is_active")
    search_fields = ("title", "type")


@admin.register(TaskCompletion)
class TaskCompletionAdmin(admin.ModelAdmin):
    """A story task never gets submitted proof — the parent just posts the
    story and an admin who happens to see it (they follow the channel/page)
    comes here, adds a row for that parent (autocomplete finds them by
    short id/telegram username/email) with the right task, and approves it.
    Approving credits the wallet immediately (see TaskCompletion.approve)."""

    list_display = ("parent", "short_id", "task", "status", "submitted_at", "reviewed_at")
    list_filter = ("status", "task")
    autocomplete_fields = ["parent", "task"]
    actions = ["approve_selected", "reject_selected"]

    def short_id(self, obj):
        return obj.parent.short_id

    def approve_selected(self, request, queryset):
        for completion in queryset:
            completion.approve(reviewed_by=request.user.email or "admin")

    def reject_selected(self, request, queryset):
        for completion in queryset:
            completion.reject(reviewed_by=request.user.email or "admin")


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("family", "balance_uzs")


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ("wallet", "amount_uzs", "reason", "created_at")
    list_filter = ("reason",)
