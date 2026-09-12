from datetime import timedelta

from django.utils import timezone

from .aggregate import week_bounds, weekly_summary_for_child
from .groq import generate_weekly_insight
from .models import WeeklyInsight

# A "refresh" tap can force a fresh generation, but never more than this
# often per child — bounds cost from someone mashing the button.
MIN_REFRESH_INTERVAL = timedelta(hours=1)


def get_or_generate_weekly_insight(child, force: bool = False) -> WeeklyInsight | None:
    """The current (most recently completed) week's insight for a child,
    generating it if missing. Returns None if there's nothing to analyze
    (no linked devices) or Groq isn't configured/failed."""
    week_start, week_end = week_bounds()
    existing = WeeklyInsight.objects.filter(child=child, week_start=week_start).first()

    if existing and not force:
        return existing
    if existing and force and timezone.now() - existing.created_at < MIN_REFRESH_INTERVAL:
        return existing

    week_data = weekly_summary_for_child(child, week_start, week_end)
    if week_data is None:
        return existing

    result = generate_weekly_insight(week_data)
    if result is None:
        return existing

    insight, _ = WeeklyInsight.objects.update_or_create(
        child=child, week_start=week_start, defaults=result
    )
    return insight
