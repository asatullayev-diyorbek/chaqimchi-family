from datetime import datetime, time, timedelta

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser, Subscription
from apps.devices.models import Child, ChildDevice
from apps.tracking.models import Event, EventBatch

from .aggregate import period_bounds, week_bounds
from .models import WeeklyInsight
from .service import store_insight

FAKE_RESULT = {
    "summary": "Bu hafta ekran vaqti barqaror bo'ldi.",
    "highlights": ["Kechqurun ko'proq vaqt sarflangan"],
    "recommendations": ["Uxlashdan oldin ekran vaqtini kamaytiring"],
    "risk_level": "watch",
}


def _tag_telemetry(device, period=WeeklyInsight.PERIOD_LAST_WEEK):
    """A device only counts as tracked for a period if it sent SOME event
    during it (see aggregate.weekly_summary_for_child) — mirrors a real
    agent heartbeat so bundle tests don't look like an untracked period."""
    _, range_start, _, _ = period_bounds(period)
    tz = timezone.get_current_timezone()
    occurred_at = timezone.make_aware(datetime.combine(range_start, time(hour=12)), tz)
    batch = EventBatch.objects.create(device=device, batch_id=f"test-{device.id}-{period}")
    Event.objects.create(batch=batch, device=device, event_type="device_state", payload={}, occurred_at=occurred_at)


class ChildInsightViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.child = Child.objects.create(family=self.parent.family, name="Ali")
        ChildDevice.objects.create(
            family=self.parent.family, child=self.child, status=ChildDevice.STATUS_LINKED
        )
        self.parent.family.subscription.plan = Subscription.PLAN_MAX
        self.parent.family.subscription.save()
        self.client.force_authenticate(user=self.parent)
        self.url = reverse("insights-child", kwargs={"child_id": self.child.id})

    def test_beta_plan_is_rejected_with_upgrade_hint(self):
        # Beta's 7-day trial includes ai_analysis — the upsell only kicks in
        # once that trial has lapsed.
        sub = self.parent.family.subscription
        sub.plan = Subscription.PLAN_BETA
        sub.started_at = timezone.now() - timedelta(days=Subscription.TRIAL_DAYS + 1)
        sub.save()
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 403)
        self.assertTrue(r.json()["upgrade_required"])

    def test_404_when_nothing_cached_yet(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 404)

    def test_returns_cached_insight(self):
        store_insight(self.child, FAKE_RESULT)
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.json()["summary"], FAKE_RESULT["summary"])
        self.assertEqual(r.json()["risk_level"], "watch")

    def test_other_family_cannot_read(self):
        other = ParentUser.objects.create_user(email="o@example.com", password="supersecret1")
        self.client.force_authenticate(user=other)
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 403)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 401)


class ChildInsightDataViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.child = Child.objects.create(family=self.parent.family, name="Ali")
        self.parent.family.subscription.plan = Subscription.PLAN_MAX
        self.parent.family.subscription.save()
        self.client.force_authenticate(user=self.parent)
        self.url = reverse("insights-child-data", kwargs={"child_id": self.child.id})

    def test_404_without_linked_device(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 404)

    def test_404_when_device_sent_no_telemetry_this_week(self):
        ChildDevice.objects.create(
            family=self.parent.family, child=self.child, status=ChildDevice.STATUS_LINKED
        )
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 404)

    def test_returns_week_bundle_for_linked_device(self):
        device = ChildDevice.objects.create(
            family=self.parent.family, child=self.child, status=ChildDevice.STATUS_LINKED
        )
        _tag_telemetry(device)
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.json()["child_name"], "Ali")
        self.assertIn("top_apps", r.json())
        self.assertEqual(r.json()["period"], "last_week")
        self.assertFalse(r.json()["is_partial"])

    def test_this_week_and_today_are_marked_partial(self):
        device = ChildDevice.objects.create(
            family=self.parent.family, child=self.child, status=ChildDevice.STATUS_LINKED
        )
        for period in (WeeklyInsight.PERIOD_THIS_WEEK, WeeklyInsight.PERIOD_TODAY):
            _tag_telemetry(device, period)
            r = self.client.get(self.url, {"period": period})
            self.assertEqual(r.status_code, 200, r.data)
            self.assertEqual(r.json()["period"], period)
            self.assertTrue(r.json()["is_partial"])

    def test_rejects_unknown_period(self):
        r = self.client.get(self.url, {"period": "next_year"})
        self.assertEqual(r.status_code, 400)


class ChildInsightSubmitViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.child = Child.objects.create(family=self.parent.family, name="Ali")
        ChildDevice.objects.create(
            family=self.parent.family, child=self.child, status=ChildDevice.STATUS_LINKED
        )
        self.parent.family.subscription.plan = Subscription.PLAN_MAX
        self.parent.family.subscription.save()
        self.client.force_authenticate(user=self.parent)
        self.url = reverse("insights-child-submit", kwargs={"child_id": self.child.id})

    def test_stores_valid_result(self):
        r = self.client.post(self.url, FAKE_RESULT, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(WeeklyInsight.objects.count(), 1)

    def test_rejects_malformed_result(self):
        r = self.client.post(self.url, {"summary": ""}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_stores_a_separate_row_per_period(self):
        self.client.post(self.url, {**FAKE_RESULT, "period": "last_week"}, format="json")
        self.client.post(self.url, {**FAKE_RESULT, "period": "this_week"}, format="json")
        self.client.post(self.url, {**FAKE_RESULT, "period": "today"}, format="json")
        self.assertEqual(WeeklyInsight.objects.filter(child=self.child).count(), 3)

    def test_resubmitting_same_period_updates_in_place(self):
        self.client.post(self.url, {**FAKE_RESULT, "period": "today"}, format="json")
        self.client.post(self.url, {**FAKE_RESULT, "summary": "Yangilangan", "period": "today"}, format="json")
        insight = WeeklyInsight.objects.get(child=self.child, period="today")
        self.assertEqual(insight.summary, "Yangilangan")


@override_settings(INSIGHTS_CRON_SECRET="cron-x")
class PendingBatchViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("insights-pending-batch")

    def test_wrong_secret_is_forbidden(self):
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_lists_max_family_child_missing_this_week(self):
        parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        parent.family.subscription.plan = Subscription.PLAN_MAX
        parent.family.subscription.save()
        child = Child.objects.create(family=parent.family, name="Ali")
        device = ChildDevice.objects.create(family=parent.family, child=child, status=ChildDevice.STATUS_LINKED)
        _tag_telemetry(device)

        r = self.client.get(self.url, HTTP_X_INSIGHTS_CRON_SECRET="cron-x")
        self.assertEqual(r.status_code, 200)
        pending = r.json()["pending"]
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["child_id"], str(child.id))

    def test_untracked_week_is_excluded(self):
        parent = ParentUser.objects.create_user(email="u@example.com", password="supersecret1")
        parent.family.subscription.plan = Subscription.PLAN_MAX
        parent.family.subscription.save()
        child = Child.objects.create(family=parent.family, name="Yangi")
        ChildDevice.objects.create(family=parent.family, child=child, status=ChildDevice.STATUS_LINKED)

        r = self.client.get(self.url, HTTP_X_INSIGHTS_CRON_SECRET="cron-x")
        self.assertEqual(r.json()["pending"], [])

    def test_beta_family_is_excluded(self):
        parent = ParentUser.objects.create_user(email="q@example.com", password="supersecret1")
        child = Child.objects.create(family=parent.family, name="Vali")
        device = ChildDevice.objects.create(family=parent.family, child=child, status=ChildDevice.STATUS_LINKED)
        _tag_telemetry(device)

        r = self.client.get(self.url, HTTP_X_INSIGHTS_CRON_SECRET="cron-x")
        self.assertEqual(r.json()["pending"], [])

    def test_already_generated_child_is_excluded(self):
        parent = ParentUser.objects.create_user(email="r@example.com", password="supersecret1")
        parent.family.subscription.plan = Subscription.PLAN_MAX
        parent.family.subscription.save()
        child = Child.objects.create(family=parent.family, name="Ali")
        ChildDevice.objects.create(family=parent.family, child=child, status=ChildDevice.STATUS_LINKED)
        week_start, _ = week_bounds()
        WeeklyInsight.objects.create(child=child, week_start=week_start, summary="s")

        r = self.client.get(self.url, HTTP_X_INSIGHTS_CRON_SECRET="cron-x")
        self.assertEqual(r.json()["pending"], [])


@override_settings(INSIGHTS_CRON_SECRET="cron-x")
class CronSubmitViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("insights-cron-submit")

    def test_wrong_secret_is_forbidden(self):
        self.assertEqual(self.client.post(self.url).status_code, 403)

    def test_stores_and_notifies_telegram_linked_parent(self):
        from unittest.mock import patch

        parent = ParentUser.objects.create_telegram_user(
            telegram_id=555, telegram_username="p", full_name="P"
        )
        child = Child.objects.create(family=parent.family, name="Ali")

        with patch("apps.accounts.telegram.send_text") as mock_send:
            r = self.client.post(
                self.url,
                {"child_id": str(child.id), "result": FAKE_RESULT},
                format="json",
                HTTP_X_INSIGHTS_CRON_SECRET="cron-x",
            )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.json()["notified"], 1)
        self.assertEqual(WeeklyInsight.objects.count(), 1)
        mock_send.assert_called_once()

    def test_rejects_malformed_result(self):
        parent = ParentUser.objects.create_user(email="p2@example.com", password="supersecret1")
        child = Child.objects.create(family=parent.family, name="Ali")
        r = self.client.post(
            self.url,
            {"child_id": str(child.id), "result": {"summary": ""}},
            format="json",
            HTTP_X_INSIGHTS_CRON_SECRET="cron-x",
        )
        self.assertEqual(r.status_code, 400)
