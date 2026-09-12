from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser, Subscription
from apps.devices.models import Child, ChildDevice

from .models import WeeklyInsight

FAKE_RESULT = {
    "summary": "Bu hafta ekran vaqti barqaror bo'ldi.",
    "highlights": ["Kechqurun ko'proq vaqt sarflangan"],
    "recommendations": ["Uxlashdan oldin ekran vaqtini kamaytiring"],
    "risk_level": "watch",
}


@override_settings(GROQ_API_KEY="test-key", GROQ_MODEL="test-model")
class ChildInsightViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.child = Child.objects.create(family=self.parent.family, name="Ali")
        ChildDevice.objects.create(
            family=self.parent.family, child=self.child, status=ChildDevice.STATUS_LINKED
        )
        self.client.force_authenticate(user=self.parent)
        self.url = reverse("insights-child", kwargs={"child_id": self.child.id})

    def test_beta_plan_is_rejected_with_upgrade_hint(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 403)
        self.assertTrue(r.json()["upgrade_required"])

    @patch("apps.insights.service.generate_weekly_insight")
    def test_max_plan_generates_and_returns_insight(self, mock_generate):
        mock_generate.return_value = FAKE_RESULT
        self.parent.family.subscription.plan = Subscription.PLAN_MAX
        self.parent.family.subscription.save()

        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.json()["summary"], FAKE_RESULT["summary"])
        self.assertEqual(r.json()["risk_level"], "watch")
        self.assertEqual(WeeklyInsight.objects.count(), 1)
        mock_generate.assert_called_once()

    @patch("apps.insights.service.generate_weekly_insight")
    def test_second_request_same_week_does_not_call_groq_again(self, mock_generate):
        mock_generate.return_value = FAKE_RESULT
        self.parent.family.subscription.plan = Subscription.PLAN_MAX
        self.parent.family.subscription.save()

        self.client.get(self.url)
        self.client.get(self.url)
        mock_generate.assert_called_once()

    @override_settings(GROQ_API_KEY="", GROQ_MODEL="")
    def test_503_when_groq_not_configured(self):
        self.parent.family.subscription.plan = Subscription.PLAN_MAX
        self.parent.family.subscription.save()
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 503)

    def test_other_family_cannot_read(self):
        other = ParentUser.objects.create_user(email="o@example.com", password="supersecret1")
        self.client.force_authenticate(user=other)
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 403)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, 401)


@override_settings(DIGEST_CRON_SECRET="cron-x")
class WeeklyRunViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("insights-weekly-run")

    def test_wrong_secret_is_forbidden(self):
        self.assertEqual(self.client.post(self.url).status_code, 403)

    @patch("apps.insights.views.get_or_generate_weekly_insight")
    @patch("apps.accounts.telegram.send_text")
    def test_sends_to_max_family_telegram_parents(self, mock_send, mock_get_insight):
        parent = ParentUser.objects.create_telegram_user(
            telegram_id=555, telegram_username="p", full_name="P"
        )
        parent.family.subscription.plan = Subscription.PLAN_MAX
        parent.family.subscription.save()
        Child.objects.create(family=parent.family, name="Ali")

        mock_get_insight.return_value = WeeklyInsight(
            child_id=None, summary="s", highlights=[], recommendations=[], risk_level="ok"
        )

        r = self.client.post(self.url, HTTP_X_DIGEST_SECRET="cron-x")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["sent"], 1)
        mock_send.assert_called_once()

    def test_beta_family_is_skipped(self):
        parent = ParentUser.objects.create_telegram_user(
            telegram_id=556, telegram_username="p2", full_name="P2"
        )
        Child.objects.create(family=parent.family, name="Vali")
        r = self.client.post(self.url, HTTP_X_DIGEST_SECRET="cron-x")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["sent"], 0)
