from django.db import models


class WeeklyInsight(models.Model):
    """One AI-generated weekly summary per child. Unique per (child,
    week_start) — this IS the cache: a re-request within the same week
    returns the stored row instead of calling Groq again. Generated lazily
    on first read, or proactively by the weekly cron (see views.py)."""

    RISK_OK = "ok"
    RISK_WATCH = "watch"
    RISK_CONCERN = "concern"
    RISK_CHOICES = [
        (RISK_OK, "Yaxshi"),
        (RISK_WATCH, "Kuzatish kerak"),
        (RISK_CONCERN, "Tashvishli"),
    ]

    child = models.ForeignKey("devices.Child", on_delete=models.CASCADE, related_name="weekly_insights")
    week_start = models.DateField()  # Monday of the analyzed week
    summary = models.TextField()
    highlights = models.JSONField(default=list)
    recommendations = models.JSONField(default=list)
    risk_level = models.CharField(max_length=10, choices=RISK_CHOICES, default=RISK_OK)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("child", "week_start")]
        ordering = ["-week_start"]

    def __str__(self):
        return f"{self.child} — {self.week_start}"
