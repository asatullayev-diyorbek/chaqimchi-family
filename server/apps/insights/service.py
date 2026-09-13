"""No Groq calls happen in Django — PythonAnywhere's outbound IP range is
blocked by Cloudflare in front of api.groq.com (confirmed by hand: HTTP 403
"error code: 1010", an ASN/datacenter block Vercel's egress isn't subject
to). Generation happens on Vercel instead — client-triggered for on-demand
(parent-web/src/app/api/groq-relay) and cron-triggered for the weekly push
(parent-web/src/app/api/weekly-insight-cron). Django's job is just to hand
out the raw week-data bundle and store whatever result comes back."""

from .aggregate import period_bounds
from .models import WeeklyInsight

MAX_HIGHLIGHTS = 10
MAX_RECOMMENDATIONS = 10
MAX_SUMMARY_LEN = 2000
MAX_ITEM_LEN = 500


def get_cached_insight(child, period=WeeklyInsight.PERIOD_LAST_WEEK) -> WeeklyInsight | None:
    """The current insight for a child + period, if one has already been
    generated today (for this_week/today) or this week (for last_week) —
    never triggers generation itself."""
    period_start, _, _, _ = period_bounds(period)
    return WeeklyInsight.objects.filter(child=child, period=period, week_start=period_start).first()


def store_insight(child, result: dict, period=WeeklyInsight.PERIOD_LAST_WEEK) -> WeeklyInsight | None:
    """Validates and stores a Groq-generated result (from either submit
    path). Returns None if result is malformed — this is now
    externally-supplied data (a client, or the Vercel cron), not a value we
    computed ourselves, so it's re-validated here rather than trusted."""
    summary = str(result.get("summary") or "").strip()[:MAX_SUMMARY_LEN]
    if not summary:
        return None
    risk_level = result.get("risk_level")
    if risk_level not in (WeeklyInsight.RISK_OK, WeeklyInsight.RISK_WATCH, WeeklyInsight.RISK_CONCERN):
        risk_level = WeeklyInsight.RISK_OK
    highlights = [str(h)[:MAX_ITEM_LEN] for h in (result.get("highlights") or [])][:MAX_HIGHLIGHTS]
    recommendations = [
        str(r)[:MAX_ITEM_LEN] for r in (result.get("recommendations") or [])
    ][:MAX_RECOMMENDATIONS]

    period_start, _, _, _ = period_bounds(period)
    insight, _ = WeeklyInsight.objects.update_or_create(
        child=child,
        period=period,
        week_start=period_start,
        defaults={
            "summary": summary,
            "highlights": highlights,
            "recommendations": recommendations,
            "risk_level": risk_level,
        },
    )
    return insight
