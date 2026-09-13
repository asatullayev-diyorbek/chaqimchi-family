from unittest import mock

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import ParentUser, Subscription
from apps.billing.models import Invoice

from . import service
from .models import Task, TaskCompletion


def _make_tasks():
    Task.objects.update_or_create(type=Task.TYPE_CHANNEL_JOIN, defaults=dict(title="Kanalga a'zolik", reward_uzs=1000, channel_username="@spino24channel"))
    Task.objects.update_or_create(type=Task.TYPE_REFERRAL, defaults=dict(title="Do'stni taklif qilish", reward_uzs=1000))
    Task.objects.update_or_create(type=Task.TYPE_TELEGRAM_STORY, defaults=dict(title="Telegram'da story", reward_uzs=1500))
    Task.objects.update_or_create(type=Task.TYPE_INSTAGRAM_STORY, defaults=dict(title="Instagram'da story", reward_uzs=1500))


class WalletTests(TestCase):
    def test_credit_and_debit_update_balance_and_ledger(self):
        parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        wallet = service.get_wallet(parent.family)
        wallet.credit(1000, "test credit")
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance_uzs, 1000)

        wallet.debit(400, "test debit")
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance_uzs, 600)
        self.assertEqual(wallet.transactions.count(), 2)


class ChannelJoinTaskTests(TestCase):
    def setUp(self):
        _make_tasks()
        self.parent = ParentUser.objects.create_user(
            email="p@example.com", password="supersecret1", telegram_id=111
        )

    @mock.patch("apps.accounts.tg_api.call")
    def test_completes_and_credits_wallet_when_member(self, api):
        api.return_value = {"ok": True, "result": {"status": "member"}}
        completion = service.complete_channel_join(self.parent)
        self.assertEqual(completion.status, TaskCompletion.STATUS_APPROVED)
        self.assertEqual(service.get_wallet(self.parent.family).balance_uzs, 1000)

    @mock.patch("apps.accounts.tg_api.call")
    def test_does_not_double_credit_on_repeat_check(self, api):
        api.return_value = {"ok": True, "result": {"status": "member"}}
        service.complete_channel_join(self.parent)
        service.complete_channel_join(self.parent)
        self.assertEqual(service.get_wallet(self.parent.family).balance_uzs, 1000)

    @mock.patch("apps.accounts.tg_api.call")
    def test_is_channel_member_false_when_not_a_member(self, api):
        api.return_value = {"ok": True, "result": {"status": "left"}}
        self.assertFalse(service.is_channel_member(self.parent))


class ReferralTests(TestCase):
    def setUp(self):
        _make_tasks()
        self.referrer = ParentUser.objects.create_user(
            email="ref@example.com", password="supersecret1", telegram_id=222
        )
        self.referred = ParentUser.objects.create_user(
            email="new@example.com", password="supersecret1", telegram_id=333, referred_by=self.referrer
        )

    @mock.patch("apps.accounts.tg_api.call")
    def test_referrer_credited_only_when_referred_joins_channel(self, api):
        api.return_value = {"ok": True, "result": {"status": "member"}}
        self.assertEqual(service.get_wallet(self.referrer.family).balance_uzs, 0)
        service.complete_channel_join(self.referred)
        self.assertEqual(service.get_wallet(self.referrer.family).balance_uzs, 1000)
        # Referred parent's own channel-join reward is separate and unaffected.
        self.assertEqual(service.get_wallet(self.referred.family).balance_uzs, 1000)

    @mock.patch("apps.accounts.tg_api.call")
    def test_referrer_reward_is_repeatable_across_multiple_friends(self, api):
        api.return_value = {"ok": True, "result": {"status": "member"}}
        second_referred = ParentUser.objects.create_user(
            email="new2@example.com", password="supersecret1", telegram_id=444, referred_by=self.referrer
        )
        service.complete_channel_join(self.referred)
        service.complete_channel_join(second_referred)
        self.assertEqual(service.get_wallet(self.referrer.family).balance_uzs, 2000)

    @mock.patch("apps.accounts.tg_api.call")
    def test_double_check_does_not_double_credit_referrer(self, api):
        api.return_value = {"ok": True, "result": {"status": "member"}}
        service.complete_channel_join(self.referred)
        service.complete_channel_join(self.referred)
        self.assertEqual(service.get_wallet(self.referrer.family).balance_uzs, 1000)


class StoryTaskManualApprovalTests(TestCase):
    """Story tasks have no submission step — an admin who spots the story
    themselves creates/approves the TaskCompletion directly (this is
    exactly what apps.tasks.admin.TaskCompletionAdmin's approve_selected
    action does), so these tests exercise that path straight through the
    model rather than any bot/API flow."""

    def setUp(self):
        _make_tasks()
        self.parent = ParentUser.objects.create_user(
            email="p@example.com", password="supersecret1", telegram_id=555
        )

    def test_admin_created_completion_can_be_approved_and_credits_wallet(self):
        task = Task.objects.get(type=Task.TYPE_TELEGRAM_STORY)
        completion = TaskCompletion.objects.create(task=task, parent=self.parent)
        completion.approve(reviewed_by="admin")
        self.assertEqual(service.get_wallet(self.parent.family).balance_uzs, 1500)

    def test_rejecting_a_completion_does_not_credit_wallet(self):
        task = Task.objects.get(type=Task.TYPE_INSTAGRAM_STORY)
        completion = TaskCompletion.objects.create(task=task, parent=self.parent)
        completion.reject(reviewed_by="admin", note="ID raqami mos kelmadi")
        self.assertEqual(service.get_wallet(self.parent.family).balance_uzs, 0)
        self.assertEqual(completion.status, TaskCompletion.STATUS_REJECTED)

    def test_approving_twice_does_not_double_credit(self):
        task = Task.objects.get(type=Task.TYPE_TELEGRAM_STORY)
        completion = TaskCompletion.objects.create(task=task, parent=self.parent)
        completion.approve(reviewed_by="admin")
        completion.approve(reviewed_by="admin")
        self.assertEqual(service.get_wallet(self.parent.family).balance_uzs, 1500)

    def test_short_id_is_zero_padded_to_four_digits(self):
        self.assertEqual(len(self.parent.short_id), 4)
        self.assertEqual(self.parent.short_id, f"{self.parent.id:04d}")


@override_settings(TELEGRAM_BOT_USERNAME="ChaqimchiGuardBot")
class TaskListAndActionViewTests(TestCase):
    def setUp(self):
        _make_tasks()
        self.parent = ParentUser.objects.create_user(
            email="p@example.com", password="supersecret1", telegram_id=888
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.parent)

    def test_list_includes_balance_referral_link_and_tasks(self):
        r = self.client.get(reverse("tasks-list"))
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["balance_uzs"], 0)
        self.assertIn(f"ref_{self.parent.id}", body["referral_link"])
        self.assertEqual(len(body["tasks"]), 4)

    @mock.patch("apps.accounts.tg_api.call")
    def test_channel_check_view_credits_wallet_when_member(self, api):
        api.return_value = {"ok": True, "result": {"status": "member"}}
        r = self.client.post(reverse("tasks-channel-check"))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["member"])
        self.assertEqual(service.get_wallet(self.parent.family).balance_uzs, 1000)

    @mock.patch("apps.accounts.tg_api.call")
    def test_channel_check_view_reports_not_a_member(self, api):
        api.return_value = {"ok": True, "result": {"status": "left"}}
        r = self.client.post(reverse("tasks-channel-check"))
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["member"])

    def test_list_includes_short_id(self):
        r = self.client.get(reverse("tasks-list"))
        self.assertEqual(r.json()["short_id"], self.parent.short_id)

    def test_channel_join_target_url_is_derived_from_channel_username(self):
        r = self.client.get(reverse("tasks-list"))
        channel_task = next(t for t in r.json()["tasks"] if t["type"] == Task.TYPE_CHANNEL_JOIN)
        self.assertEqual(channel_task["target_url"], "https://t.me/spino24channel")


@override_settings(PAYME_MERCHANT_ID="m1", PAYME_MERCHANT_KEY="k1")
class WalletCheckoutTests(TestCase):
    def setUp(self):
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret1")
        self.client = APIClient()
        self.client.force_authenticate(user=self.parent)

    def test_insufficient_balance_returns_402(self):
        r = self.client.post(reverse("billing-checkout-wallet"), {"plan": "mini", "months": 1}, format="json")
        self.assertEqual(r.status_code, 402)

    def test_full_balance_activates_subscription_without_invoice(self):
        wallet = service.get_wallet(self.parent.family)
        wallet.credit(25_000, "test")
        r = self.client.post(reverse("billing-checkout-wallet"), {"plan": "mini", "months": 1}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["balance_uzs"], 0)
        self.parent.family.subscription.refresh_from_db()
        self.assertEqual(self.parent.family.subscription.plan, Subscription.PLAN_MINI)
        self.assertEqual(Invoice.objects.count(), 0)
