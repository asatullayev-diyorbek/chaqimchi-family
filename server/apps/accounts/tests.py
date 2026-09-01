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
