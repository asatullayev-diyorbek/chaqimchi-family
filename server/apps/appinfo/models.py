from django.db import models


class AppInfo(models.Model):
    """A parent-friendly explanation of one app: what it is, and its
    benefits/risks for a child. Keyed by the raw exe/package name (lowercased)
    rather than per-family — unlike WeeklyInsight, this isn't personal data:
    "roblox.exe" means the same thing for every family, so one Groq-generated
    row here serves every parent who ever taps that app, instead of
    regenerating the same explanation per family. Generated on demand from
    parent-mobile via the Vercel relay (see apps.insights.service for why
    Django itself never calls Groq)."""

    key = models.CharField(max_length=255, unique=True)  # lowercased exe/package name
    display_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True)
    description = models.TextField()
    benefits = models.JSONField(default=list)
    risks = models.JSONField(default=list)
    age_note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name or self.key
