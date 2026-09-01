from unittest import mock

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from .models import ParentUser, TelegramLoginToken

WEBHOOK_HEADERS = {"HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN": "test-secret"}


@override_settings(
    TELEGRAM_BOT_TOKEN="x", TELEGRAM_BOT_USERNAME="ChaqimchiGuardBot",
    TELEGRAM_WEBHOOK_SECRET="test-secret",
)
@mock.patch("apps.accounts.telegram._telegram_api_call", return_value=None)
class TelegramLinkTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="supersecret123")
        self.client.force_authenticate(user=self.parent)

    def _confirm(self, token):
        self.client.post(
            reverse("telegram-webhook"),
            {"callback_query": {"id": "cb1", "data": f"tglogin_confirm:{token}",
                                "message": {"chat": {"id": 42}, "message_id": 7},
                                "from": {"id": 777001, "username": "diyor"}}},
            format="json", **WEBHOOK_HEADERS,
        )

    def test_link_flow(self, _api):
        r = self.client.post(reverse("telegram-link-start"))
        self.assertEqual(r.status_code, 201)
        token = r.json()["token"]

        self.assertEqual(self.client.get(reverse("telegram-link-status", args=[token])).json()["status"], "pending")

        # Telegram user taps confirm
        self.client.post(
            reverse("telegram-webhook"),
            {"message": {"text": f"/start {token}", "chat": {"id": 42}}},
            format="json", **WEBHOOK_HEADERS,
        )
        self._confirm(token)

        self.parent.refresh_from_db()
        self.assertEqual(self.parent.telegram_id, 777001)
        self.assertEqual(self.parent.telegram_username, "diyor")
        self.assertEqual(self.client.get(reverse("telegram-link-status", args=[token])).json()["status"], "linked")

    def test_cannot_link_a_telegram_already_on_another_account(self, _api):
        ParentUser.objects.create_user(email="other@example.com", password="supersecret123", telegram_id=777001)
        token = self.client.post(reverse("telegram-link-start")).json()["token"]
        self._confirm(token)

        self.parent.refresh_from_db()
        self.assertIsNone(self.parent.telegram_id)
        self.assertEqual(self.client.get(reverse("telegram-link-status", args=[token])).json()["status"], "rejected")

    def test_link_start_refused_when_already_linked(self, _api):
        self.parent.telegram_id = 5
        self.parent.save(update_fields=["telegram_id"])
        self.assertEqual(self.client.post(reverse("telegram-link-start")).status_code, 400)

    def test_unlink(self, _api):
        self.parent.telegram_id = 5
        self.parent.telegram_username = "x"
        self.parent.save(update_fields=["telegram_id", "telegram_username"])
        r = self.client.post(reverse("telegram-unlink"))
        self.assertEqual(r.status_code, 200)
        self.parent.refresh_from_db()
        self.assertIsNone(self.parent.telegram_id)

    def test_link_token_does_not_work_as_a_login_token(self, _api):
        token = self.client.post(reverse("telegram-link-start")).json()["token"]
        # a stranger tries to use the link token to sign in
        self.client.post(
            reverse("telegram-webhook"),
            {"callback_query": {"id": "cb", "data": f"tglogin_confirm:{token}",
                                "message": {"chat": {"id": 1}, "message_id": 1},
                                "from": {"id": 999, "username": "stranger"}}},
            format="json", **WEBHOOK_HEADERS,
        )
        # it linked to the original parent (the token's owner), not logged anyone in
        self.parent.refresh_from_db()
        self.assertEqual(self.parent.telegram_id, 999)
        self.assertEqual(TelegramLoginToken.objects.filter(is_link=False).count(), 0)


@override_settings(
    TELEGRAM_BOT_TOKEN="x", TELEGRAM_BOT_USERNAME="ChaqimchiGuardBot",
    TELEGRAM_WEBHOOK_SECRET="test-secret",
)
@mock.patch("apps.accounts.telegram._telegram_api_call", return_value=None)
class TelegramBotCommandTests(TestCase):
    def setUp(self):
        from apps.devices.models import Child, ChildDevice

        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(
            email="p@example.com", password="supersecret123", telegram_id=555999,
        )
        child = Child.objects.create(family=self.parent.family, name="Ali")
        ChildDevice.objects.create(
            family=self.parent.family, child=child, status=ChildDevice.STATUS_LINKED,
        )

    def _send(self, text, from_id=555999):
        return self.client.post(
            reverse("telegram-webhook"),
            {"message": {"text": text, "chat": {"id": 1}, "from": {"id": from_id}}},
            format="json", **WEBHOOK_HEADERS,
        )

    def test_commands_reply_for_a_linked_parent(self, api):
        for cmd in ("/bugun", "/qurilmalar", "/ogohlantirishlar", "/help"):
            api.reset_mock()
            self.assertEqual(self._send(cmd).status_code, 200)
            api.assert_called_once()
            self.assertEqual(api.call_args[0][0], "sendMessage")

    def test_unlinked_sender_is_told_to_link(self, api):
        self._send("/bugun", from_id=111111)
        text = api.call_args[0][1]["text"]
        self.assertIn("ulanmagan", text)

    def test_start_with_token_is_not_treated_as_a_command(self, api):
        # "/start <uuid>" must still go to the pairing flow, not the bot menu
        self._send("/start 00000000-0000-0000-0000-000000000000")
        # pairing flow sends "havola muddati tugagan..." for an unknown token
        self.assertIn("muddati", api.call_args[0][1]["text"].lower())


@override_settings(
    TELEGRAM_BOT_TOKEN="x", TELEGRAM_BOT_USERNAME="b", TELEGRAM_WEBHOOK_SECRET="test-secret",
)
@mock.patch("apps.accounts.telegram._telegram_api_call", return_value=None)
class TelegramAlertSeenCallbackTests(TestCase):
    def setUp(self):
        from apps.devices.models import ChildDevice
        from apps.alerts.models import Alert
        from django.utils import timezone

        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(
            email="p@example.com", password="supersecret123", telegram_id=42,
        )
        device = ChildDevice.objects.create(family=self.parent.family, status=ChildDevice.STATUS_LINKED)
        self.alert = Alert.objects.create(
            device=device, alert_type="limit_reached", payload={}, triggered_at=timezone.now(),
        )

    def _tap(self, alert_id, from_id=42):
        return self.client.post(
            reverse("telegram-webhook"),
            {"callback_query": {"id": "cb", "data": f"alertseen:{alert_id}",
                                "message": {"chat": {"id": 1}, "message_id": 2}, "from": {"id": from_id}}},
            format="json", **WEBHOOK_HEADERS,
        )

    def test_tapping_seen_marks_the_alert(self, _api):
        self._tap(self.alert.id)
        self.alert.refresh_from_db()
        self.assertTrue(self.alert.seen)

    def test_a_stranger_cannot_mark_someone_elses_alert(self, _api):
        self._tap(self.alert.id, from_id=99999)
        self.alert.refresh_from_db()
        self.assertFalse(self.alert.seen)
