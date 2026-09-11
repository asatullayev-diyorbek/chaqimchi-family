from django.contrib import admin

from .models import Invoice


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "family", "plan", "amount_uzs", "provider", "status", "created_at", "paid_at")
    list_filter = ("provider", "status", "plan")
    search_fields = ("id", "family__id", "provider_transaction_id")
    readonly_fields = [f.name for f in Invoice._meta.fields]
