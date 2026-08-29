from django.contrib import admin

from .models import AgentVersion


@admin.register(AgentVersion)
class AgentVersionAdmin(admin.ModelAdmin):
    list_display = ("version", "is_active", "mandatory", "released_at")
    list_filter = ("is_active", "mandatory")
    search_fields = ("version",)
    fields = ("version", "binary_url", "sha256", "signature", "mandatory", "is_active")
    # Paste sha256 + signature from `relsign sign`; the agent refuses an
    # update whose manifest is missing either.
