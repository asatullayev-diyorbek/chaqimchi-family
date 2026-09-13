from django.db import models


class Review(models.Model):
    """One star rating + optional comment, submitted by a parent — an
    app-store-style review, not a support ticket. A parent can leave more
    than one over time (e.g. after each update they try), so this is a
    plain log: every submission is its own row, not a single editable
    "current state" like WeeklyInsight/AppInfo elsewhere in this codebase."""

    parent = models.ForeignKey(
        "accounts.ParentUser", on_delete=models.CASCADE, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.parent} — {self.rating}★"
