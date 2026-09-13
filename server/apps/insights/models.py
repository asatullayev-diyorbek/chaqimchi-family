from django.db import models


class WeeklyInsight(models.Model):
    """One AI-generated activity summary per child for one period. Unique
    per (child, period, week_start) — this IS the cache: a re-request for
    the same period on the same day returns the stored row instead of
    calling Groq again. "this_week" and "today" are necessarily partial —
    the period isn't over yet — which is why they're separate periods
    rather than just a shorter week_start/week_end: the prompt (see
    parent-web/src/lib/groq.ts) needs to know a period is still in progress
    so it doesn't narrate it as a finished week. Generated on demand
    (any period), or proactively by the weekly cron (last_week only —
    see views.py)."""

    RISK_OK = "ok"
    RISK_WATCH = "watch"
    RISK_CONCERN = "concern"
    RISK_CHOICES = [
        (RISK_OK, "Yaxshi"),
        (RISK_WATCH, "Kuzatish kerak"),
        (RISK_CONCERN, "Tashvishli"),
    ]

    PERIOD_LAST_WEEK = "last_week"
    PERIOD_THIS_WEEK = "this_week"
    PERIOD_TODAY = "today"
    PERIOD_CHOICES = [
        (PERIOD_LAST_WEEK, "O'tgan hafta"),
        (PERIOD_THIS_WEEK, "Shu hafta"),
        (PERIOD_TODAY, "Bugun"),
    ]

    child = models.ForeignKey("devices.Child", on_delete=models.CASCADE, related_name="weekly_insights")
    period = models.CharField(max_length=10, choices=PERIOD_CHOICES, default=PERIOD_LAST_WEEK)
    week_start = models.DateField()  # period anchor: Monday for week periods, the day itself for "today"
    summary = models.TextField()
    highlights = models.JSONField(default=list)
    recommendations = models.JSONField(default=list)
    risk_level = models.CharField(max_length=10, choices=RISK_CHOICES, default=RISK_OK)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("child", "period", "week_start")]
        ordering = ["-week_start"]

    def __str__(self):
        return f"{self.child} — {self.get_period_display()} ({self.week_start})"
