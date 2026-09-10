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
@mock.patch("apps.accounts.tg_api.call", return_value=None)
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
@mock.patch("apps.accounts.tg_api.call", return_value=None)
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

    def test_unlinked_sender_is_pointed_at_start(self, api):
        self._send("/bugun", from_id=111111)
        text = api.call_args[0][1]["text"]
        self.assertIn("/start", text)

    def test_start_with_token_is_not_treated_as_a_command(self, api):
        # "/start <uuid>" must still go to the pairing flow, not the bot menu
        self._send("/start 00000000-0000-0000-0000-000000000000")
        # pairing flow sends "havola muddati tugagan..." for an unknown token
        self.assertIn("muddati", api.call_args[0][1]["text"].lower())


@override_settings(
    TELEGRAM_BOT_TOKEN="x", TELEGRAM_BOT_USERNAME="b", TELEGRAM_WEBHOOK_SECRET="test-secret",
)
@mock.patch("apps.accounts.tg_api.call", return_value=None)
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


@override_settings(TELEGRAM_BOT_TOKEN="x", TELEGRAM_WEBHOOK_SECRET="s")
class AccountSelfServiceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.parent = ParentUser.objects.create_user(email="p@example.com", password="oldpass12", username="diyor")

    def test_change_password_requires_correct_old(self):
        self.client.force_authenticate(user=self.parent)
        r = self.client.post(reverse("password-change"), {"old_password": "wrong", "new_password": "newpass123"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(reverse("password-change"), {"old_password": "oldpass12", "new_password": "newpass123"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.parent.refresh_from_db()
        self.assertTrue(self.parent.check_password("newpass123"))

    def test_patch_me_updates_full_name_only(self):
        self.client.force_authenticate(user=self.parent)
        r = self.client.patch(reverse("me"), {"full_name": "Diyor A", "email": "hacker@x.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.parent.refresh_from_db()
        self.assertEqual(self.parent.full_name, "Diyor A")
        self.assertEqual(self.parent.email, "p@example.com")  # read-only

    @mock.patch("apps.accounts.account_views.send_text")
    def test_telegram_reset_flow(self, send_text):
        self.parent.telegram_id = 42
        self.parent.save(update_fields=["telegram_id"])
        self.assertEqual(self.client.post(reverse("password-reset-start"), {"username": "diyor"}, format="json").status_code, 200)
        send_text.assert_called_once()
        code = send_text.call_args[0][1].split("kodi: ")[1].split("\n")[0]

        r = self.client.post(reverse("password-reset-verify"), {"username": "diyor", "code": "000000", "new_password": "brandnew12"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(reverse("password-reset-verify"), {"username": "diyor", "code": code, "new_password": "brandnew12"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.parent.refresh_from_db()
        self.assertTrue(self.parent.check_password("brandnew12"))

    @mock.patch("apps.accounts.account_views.send_text")
    def test_reset_start_is_silent_for_unknown_or_no_telegram(self, send_text):
        self.assertEqual(self.client.post(reverse("password-reset-start"), {"username": "nobody"}, format="json").status_code, 200)
        self.assertEqual(self.client.post(reverse("password-reset-start"), {"username": "diyor"}, format="json").status_code, 200)
        send_text.assert_not_called()


class TelegramWebAppLoginTests(TestCase):
    """Auto-login for the Spino24 parent Mini App (signed initData)."""

    BOT_TOKEN = "999:WEBAPPTEST"

    def setUp(self):
        self.client = APIClient()

    def _init_data(self, user_json='{"id":555,"first_name":"Ali","username":"ali"}', auth_date=None):
        import hashlib, hmac, time
        from urllib.parse import urlencode

        fields = {"user": user_json, "auth_date": str(auth_date or int(time.time())), "query_id": "q1"}
        dcs = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
        secret = hmac.new(b"WebAppData", self.BOT_TOKEN.encode(), hashlib.sha256).digest()
        fields["hash"] = hmac.new(secret, dcs.encode(), hashlib.sha256).hexdigest()
        return urlencode(fields)

    @override_settings(TELEGRAM_BOT_TOKEN=BOT_TOKEN)
    def test_creates_user_and_returns_tokens_on_first_open(self):
        r = self.client.post(reverse("telegram-webapp"), {"init_data": self._init_data()}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.json()["is_new_user"])
        self.assertIn("access", r.json())
        user = ParentUser.objects.get(telegram_id=555)
        self.assertEqual(user.telegram_username, "ali")

    @override_settings(TELEGRAM_BOT_TOKEN=BOT_TOKEN)
    def test_second_open_reuses_user(self):
        self.client.post(reverse("telegram-webapp"), {"init_data": self._init_data()}, format="json")
        r = self.client.post(reverse("telegram-webapp"), {"init_data": self._init_data()}, format="json")
        self.assertFalse(r.json()["is_new_user"])
        self.assertEqual(ParentUser.objects.filter(telegram_id=555).count(), 1)

    @override_settings(TELEGRAM_BOT_TOKEN=BOT_TOKEN)
    def test_rejects_tampered_payload(self):
        bad = self._init_data().replace("Ali", "Eve")
        r = self.client.post(reverse("telegram-webapp"), {"init_data": bad}, format="json")
        self.assertEqual(r.status_code, 401)

    @override_settings(TELEGRAM_BOT_TOKEN=BOT_TOKEN)
    def test_rejects_stale_auth_date(self):
        stale = self._init_data(auth_date=1)
        r = self.client.post(reverse("telegram-webapp"), {"init_data": stale}, format="json")
        self.assertEqual(r.status_code, 401)

    @override_settings(TELEGRAM_BOT_TOKEN="")
    def test_503_when_bot_not_configured(self):
        r = self.client.post(reverse("telegram-webapp"), {"init_data": "x"}, format="json")
        self.assertEqual(r.status_code, 503)


@override_settings(
    TELEGRAM_BOT_TOKEN="x", TELEGRAM_BOT_USERNAME="ChaqimchiGuardBot",
    TELEGRAM_WEBHOOK_SECRET="test-secret", DIGEST_CRON_SECRET="cron-x",
)
@mock.patch("apps.accounts.tg_api.call", return_value={"ok": True})
class OnboardingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _send(self, message):
        return self.client.post(
            reverse("telegram-webhook"), {"message": message},
            format="json", **WEBHOOK_HEADERS,
        )

    def _methods(self, api):
        return [c[0][0] for c in api.call_args_list]

    def test_cold_start_creates_account_and_asks_for_phone(self, api):
        self._send({"text": "/start", "chat": {"id": 900}, "from": {"id": 900, "username": "d"}})
        u = ParentUser.objects.get(telegram_id=900)
        self.assertTrue(u.onboarding_required)
        self.assertTrue(u.family.subscription.plan, "beta")
        self.assertIn("sendPhoto", self._methods(api))  # welcome + phone-trust

    def test_contact_completes_onboarding(self, api):
        self._send({"text": "/start", "chat": {"id": 901}, "from": {"id": 901}})
        api.reset_mock()
        self._send({
            "chat": {"id": 901}, "from": {"id": 901},
            "contact": {"user_id": 901, "phone_number": "998901112233"},
        })
        u = ParentUser.objects.get(telegram_id=901)
        self.assertFalse(u.onboarding_required)
        self.assertEqual(u.phone, "+998901112233")

    def test_forwarded_contact_is_rejected(self, api):
        self._send({"text": "/start", "chat": {"id": 902}, "from": {"id": 902}})
        self._send({
            "chat": {"id": 902}, "from": {"id": 902},
            "contact": {"user_id": 555, "phone_number": "998900000000"},
        })
        self.assertTrue(ParentUser.objects.get(telegram_id=902).onboarding_required)

    def test_commands_blocked_until_phone(self, api):
        self._send({"text": "/start", "chat": {"id": 903}, "from": {"id": 903}})
        api.reset_mock()
        self._send({"text": "/bugun", "chat": {"id": 903}, "from": {"id": 903}})
        joined = " ".join(str(c) for c in api.call_args_list)
        self.assertIn("telefon", joined.lower())

    def test_menu_after_onboarding(self, api):
        self._send({"text": "/start", "chat": {"id": 904}, "from": {"id": 904}})
        self._send({
            "chat": {"id": 904}, "from": {"id": 904},
            "contact": {"user_id": 904, "phone_number": "998900000001"},
        })
        api.reset_mock()
        self._send({"text": "/menyu", "chat": {"id": 904}, "from": {"id": 904}})
        payload = api.call_args_list[0][0][1]
        self.assertEqual(api.call_args_list[0][0][0], "sendMessage")
        self.assertIn("menu:devices", str(payload))

    def test_menu_callback_edits_message(self, api):
        u = ParentUser.objects.create_user(email="m@e.com", password="supersecret1", telegram_id=905)
        self.client.post(
            reverse("telegram-webhook"),
            {"callback_query": {"id": "c", "data": "menu:devices",
                                "message": {"chat": {"id": 1}, "message_id": 5}, "from": {"id": 905}}},
            format="json", **WEBHOOK_HEADERS,
        )
        self.assertIn("editMessageText", self._methods(api))

    def test_reminder_schedule(self, api):
        from datetime import timedelta
        from django.utils import timezone

        from apps.accounts.onboarding import run_onboarding_reminders

        u = ParentUser.objects.create_telegram_user(telegram_id=906)
        # brand new — no reminder yet (needs >= 1 day old)
        self.assertEqual(run_onboarding_reminders()["reminded"], 0)

        ParentUser.objects.filter(pk=u.pk).update(created_at=timezone.now() - timedelta(days=2))
        self.assertEqual(run_onboarding_reminders()["reminded"], 1)
        u.refresh_from_db()
        self.assertEqual(u.onboarding_reminders_sent, 1)
        # 48h gap — immediate re-run does nothing
        self.assertEqual(run_onboarding_reminders()["reminded"], 0)

    def test_reminder_stops_after_three(self, api):
        from datetime import timedelta
        from django.utils import timezone

        from apps.accounts.onboarding import run_onboarding_reminders

        u = ParentUser.objects.create_telegram_user(telegram_id=907)
        ParentUser.objects.filter(pk=u.pk).update(
            created_at=timezone.now() - timedelta(days=30),
            onboarding_reminders_sent=3,
        )
        self.assertEqual(run_onboarding_reminders()["reminded"], 0)

    def test_reminder_endpoint_secret(self, api):
        r = self.client.post(reverse("onboarding-remind"), HTTP_X_DIGEST_SECRET="wrong")
        self.assertEqual(r.status_code, 403)
        r = self.client.post(reverse("onboarding-remind"), HTTP_X_DIGEST_SECRET="cron-x")
        self.assertEqual(r.status_code, 200)
        self.assertIn("reminded", r.json())

    def test_completed_parent_not_reminded(self, api):
        from datetime import timedelta
        from django.utils import timezone
        from apps.accounts.onboarding import run_onboarding_reminders

        u = ParentUser.objects.create_telegram_user(telegram_id=908)
        ParentUser.objects.filter(pk=u.pk).update(
            created_at=timezone.now() - timedelta(days=5), onboarding_required=False,
        )
        self.assertEqual(run_onboarding_reminders()["reminded"], 0)
