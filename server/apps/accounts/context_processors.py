"""Adds a business-metrics panel to the Django admin index page (see
templates/admin/index.html) — the operator's one-glance dashboard: users,
revenue, active devices, today's activity. Computed only for /admin/ requests
so every other page (including the whole public API) pays nothing for it.
"""

from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone


def admin_stats(request):
    if not request.path.startswith("/admin/"):
        return {}

    from apps.accounts.models import Family, ParentUser, Subscription
    from apps.alerts.models import Alert
    from apps.billing.models import Invoice
    from apps.devices.models import Child, ChildDevice
    from apps.screenshots.models import ScreenshotRequest

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    online_cutoff = now - timedelta(minutes=5)

    by_plan = {
        plan: Subscription.objects.filter(plan=plan, status=Subscription.STATUS_ACTIVE).count()
        for plan, _ in Subscription.PLAN_CHOICES
    }
    mrr_uzs = sum(Subscription.PLAN_PRICE_UZS[plan] * count for plan, count in by_plan.items())
    revenue_paid_uzs = (
        Invoice.objects.filter(status=Invoice.STATUS_PAID).aggregate(s=Sum("amount_uzs"))["s"] or 0
    )

    def fmt(n):
        return f"{n:,}".replace(",", " ")

    return {
        "admin_stats": {
            "mrr_fmt": fmt(mrr_uzs),
            "revenue_paid_fmt": fmt(revenue_paid_uzs),
            "families_total": Family.objects.count(),
            "users_total": ParentUser.objects.count(),
            "users_new_week": ParentUser.objects.filter(created_at__gte=week_ago).count(),
            "onboarding_pending": ParentUser.objects.filter(onboarding_required=True).count(),
            "children_total": Child.objects.count(),
            "devices_linked": ChildDevice.objects.filter(status=ChildDevice.STATUS_LINKED).count(),
            "devices_online": ChildDevice.objects.filter(
                status=ChildDevice.STATUS_LINKED, last_sync__gte=online_cutoff
            ).count(),
            "by_plan": by_plan,
            "mrr_uzs": mrr_uzs,
            "invoices_paid_total": Invoice.objects.filter(status=Invoice.STATUS_PAID).count(),
            "revenue_paid_uzs": revenue_paid_uzs,
            "screenshots_today": ScreenshotRequest.objects.filter(created_at__gte=today_start).count(),
            "alerts_today": Alert.objects.filter(triggered_at__gte=today_start).count(),
        }
    }
