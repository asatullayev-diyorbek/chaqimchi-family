"""Telegram-based login/register.

Mirrors the shape of apps.devices' enrollment flow (short-lived pairing
token + polled status endpoint), because that flow already solved the same
constraint this one has: PythonAnywhere Free hosting is WSGI-only, so
nothing here can hold a persistent connection open. Telegram's side of the
pairing is a webhook (Telegram calls us), not a long-running bot process.

Flow:
  1. Browser: POST start/ -> {token, bot_url}. Opens bot_url in a new tab
     and starts polling status/<token>/.
  2. Telegram user sends /start <token> to the bot -> Telegram calls
     webhook/ with the update; we reply with an inline "Tasdiqlash /
     Rad etish" keyboard instead of logging them in immediately, so a
     stale or someone-else's deep link can't silently log a session in.
  3. Telegram user taps a button -> Telegram calls webhook/ again with a
     callback_query. "Tasdiqlash" resolves/creates the ParentUser and
     attaches it to the token; "Rad etish" marks the token rejected.
  4. The polling browser tab's next status/<token>/ call gets JWTs back
     (minted directly, no password) and, for a brand-new user, is routed to
     a "finish registration" screen (see parent-web's /telegram/complete).
"""

from datetime import timedelta

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from . import tg_api
from .bot import handle_command
from .models import ParentUser, TelegramLoginToken
from .serializers import ParentUserSerializer

CONFIRM_PREFIX = "tglogin_confirm:"
REJECT_PREFIX = "tglogin_reject:"
ALERT_SEEN_PREFIX = "alertseen:"


def _telegram_api_call(method, payload):
    """Thin wrapper kept for backwards compatibility (tests and callers still
    reference this name); the real work is in apps.accounts.tg_api."""
    return tg_api.call(method, payload)


def send_text(chat_id, text, reply_markup=None):
    """Best-effort push to a Telegram chat, with an optional inline keyboard.
    Returns the API response dict or None; never raises."""
    return tg_api.send_message(chat_id, text, reply_markup)


def _send_confirmation_prompt(chat_id, token, is_link=False):
    text = (
        "ChaqimchiAI Guard hisobingizga ushbu Telegram'ni ulaysizmi?"
        if is_link
        else "ChaqimchiAI Guard'ga ushbu Telegram hisobingiz orqali kirishni tasdiqlaysizmi?"
    )
    _telegram_api_call(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            "reply_markup": {
                "inline_keyboard": [
                    [
                        {"text": "✅ Tasdiqlash", "callback_data": f"{CONFIRM_PREFIX}{token}"},
                        {"text": "❌ Rad etish", "callback_data": f"{REJECT_PREFIX}{token}"},
                    ]
                ]
            },
        },
    )


def _resolve_link_token(payload_token):
    try:
        return TelegramLoginToken.objects.select_related("user").get(
            token=payload_token, is_link=True, consumed=False, rejected=False,
            user__isnull=False, expires_at__gt=timezone.now(),
        )
    except (TelegramLoginToken.DoesNotExist, ValueError):
        return None


def _resolve_login_token(payload_token):
    try:
        return TelegramLoginToken.objects.get(
            token=payload_token, consumed=False, rejected=False, user__isnull=True,
            expires_at__gt=timezone.now(),
        )
    except (TelegramLoginToken.DoesNotExist, ValueError):
        return None


class TelegramStartView(APIView):
    """POST /api/auth/telegram/start/ — called by the login page, no auth."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        expires_at = timezone.now() + timedelta(minutes=settings.TELEGRAM_TOKEN_TTL_MINUTES)
        login_token = TelegramLoginToken.objects.create(expires_at=expires_at)
        bot_url = f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={login_token.token}"
        return Response(
            {"token": str(login_token.token), "bot_url": bot_url},
            status=status.HTTP_201_CREATED,
        )


class TelegramWebhookView(APIView):
    """POST /api/auth/telegram/webhook/ — called by Telegram, not the app.

    Authenticated via the secret_token Telegram echoes back on every
    webhook call (set once via the set_telegram_webhook management command),
    not via DRF auth classes — Telegram has no JWT.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not settings.TELEGRAM_WEBHOOK_SECRET or secret != settings.TELEGRAM_WEBHOOK_SECRET:
            raise PermissionDenied("Invalid webhook secret")

        if request.data.get("callback_query"):
            self._handle_callback_query(request.data["callback_query"])
        else:
            self._handle_message(request.data.get("message") or {})

        return Response({"ok": True})

    def _handle_message(self, message):
        from . import botmenu, onboarding

        text = (message.get("text") or "").strip()
        chat_id = (message.get("chat") or {}).get("id")
        from_user = message.get("from") or {}
        from_id = from_user.get("id")

        # A shared phone number from the request_contact button.
        if message.get("contact"):
            onboarding.handle_contact(message)
            return

        # "/start <token>" is the web login / account-link deep link — keep
        # it ahead of the command router.
        if text.startswith("/start ") and len(text.split()) > 1:
            payload_token = text.split(None, 1)[1].strip()
            token = _resolve_login_token(payload_token) or _resolve_link_token(payload_token)
            if token is None:
                if chat_id:
                    tg_api.send_message(
                        chat_id,
                        "Havola muddati tugagan yoki noto'g'ri. Ilovaga qaytib qaytadan urinib ko'ring.",
                    )
                return
            if chat_id:
                _send_confirmation_prompt(chat_id, token.token, is_link=token.is_link)
            return

        # A tap on one of the persistent menu buttons arrives as plain text.
        section = botmenu.matches(text)
        if section:
            parent = ParentUser.objects.filter(telegram_id=from_id).first()
            if parent is None:
                tg_api.send_message(chat_id, "Boshlash uchun /start bosing.")
            elif parent.onboarding_required:
                onboarding.send_phone_prompt(chat_id)
            else:
                botmenu.handle_menu_button(section, chat_id, parent)
            return

        if not text.startswith("/"):
            return

        cmd = text[1:].split()[0].lower().split("@")[0]
        parent = ParentUser.objects.filter(telegram_id=from_id).first()

        if cmd in ("start", "menyu", "menu"):
            if parent is None:
                onboarding.start_onboarding(from_user, chat_id)
            elif parent.onboarding_required:
                onboarding.send_phone_prompt(chat_id)
            else:
                botmenu.send_menu(chat_id, parent)
            return

        if cmd in ("yuklab_olish", "yuklab"):
            onboarding.send_install_guide(chat_id)
            return

        if parent is None:
            tg_api.send_message(chat_id, "Boshlash uchun /start buyrug'ini yuboring.")
            return
        if parent.onboarding_required:
            tg_api.send_message(chat_id, onboarding.NEED_PHONE_TEXT)
            onboarding.send_phone_prompt(chat_id)
            return

        reply = handle_command(cmd, parent)
        if reply is not None and chat_id:
            tg_api.send_message(chat_id, reply)

    def _handle_callback_query(self, callback_query):
        callback_id = callback_query.get("id")
        data = callback_query.get("data", "")
        message = callback_query.get("message") or {}
        chat_id = (message.get("chat") or {}).get("id")
        message_id = message.get("message_id")
        from_user = callback_query.get("from") or {}

        if data.startswith(ALERT_SEEN_PREFIX):
            self._mark_alert_seen(data.removeprefix(ALERT_SEEN_PREFIX), from_user, callback_id, chat_id, message_id)
            return

        if data.startswith(CONFIRM_PREFIX):
            action, payload_token = "confirm", data.removeprefix(CONFIRM_PREFIX)
        elif data.startswith(REJECT_PREFIX):
            action, payload_token = "reject", data.removeprefix(REJECT_PREFIX)
        else:
            return

        login_token = _resolve_login_token(payload_token) or _resolve_link_token(payload_token)
        if login_token is None:
            if callback_id:
                _telegram_api_call(
                    "answerCallbackQuery",
                    {"callback_query_id": callback_id, "text": "Havola muddati tugagan."},
                )
            return

        if action == "reject":
            login_token.rejected = True
            login_token.save(update_fields=["rejected"])
            result_text = "❌ Rad etildi."
        elif login_token.is_link:
            result_text = self._link_account(login_token, from_user)
        else:
            telegram_id = from_user.get("id")
            telegram_username = from_user.get("username", "")
            full_name = " ".join(
                part for part in [from_user.get("first_name", ""), from_user.get("last_name", "")] if part
            ).strip()

            user = ParentUser.objects.filter(telegram_id=telegram_id).first()
            if user is None:
                user = ParentUser.objects.create_telegram_user(
                    telegram_id=telegram_id, telegram_username=telegram_username, full_name=full_name
                )
                login_token.is_new_user = True

            login_token.user = user
            login_token.telegram_id = telegram_id
            login_token.telegram_username = telegram_username
            login_token.save(update_fields=["user", "telegram_id", "telegram_username", "is_new_user"])
            if user.onboarding_required:
                result_text = "✅ Tasdiqlandi! Davom etish uchun telefon raqamingizni yuboring."
            else:
                result_text = "✅ Tasdiqlandi! Endi brauzeringizga qaytishingiz mumkin."

        if callback_id:
            tg_api.answer_callback(callback_id)
        if chat_id and message_id:
            tg_api.edit_message_text(chat_id, message_id, result_text)
        # A web-login user still owes a phone number — prompt for it here so
        # they don't have to hunt for the bot again.
        if action == "confirm" and not login_token.is_link and chat_id:
            user = login_token.user
            if user and user.onboarding_required:
                from . import onboarding

                onboarding.send_phone_prompt(chat_id)

    @staticmethod
    def _mark_alert_seen(alert_id, from_user, callback_id, chat_id, message_id):
        from apps.alerts.models import Alert

        parent = ParentUser.objects.filter(telegram_id=from_user.get("id")).first()
        alert = Alert.objects.filter(id=alert_id).select_related("device").first() if parent else None
        if alert is None or alert.device.family_id != parent.family_id:
            if callback_id:
                _telegram_api_call("answerCallbackQuery", {"callback_query_id": callback_id, "text": "Topilmadi."})
            return

        if not alert.seen:
            alert.seen = True
            alert.save(update_fields=["seen"])
        if callback_id:
            _telegram_api_call("answerCallbackQuery", {"callback_query_id": callback_id, "text": "✓ Ko'rildi"})
        if chat_id and message_id:
            _telegram_api_call(
                "editMessageReplyMarkup", {"chat_id": chat_id, "message_id": message_id, "reply_markup": {}}
            )

    @staticmethod
    def _link_account(link_token, from_user):
        telegram_id = from_user.get("id")
        username = from_user.get("username", "")
        parent = link_token.user

        clash = ParentUser.objects.filter(telegram_id=telegram_id).exclude(pk=parent.pk).exists()
        if clash:
            link_token.rejected = True
            link_token.save(update_fields=["rejected"])
            return "❌ Bu Telegram allaqachon boshqa ChaqimchiAI hisobiga ulangan."

        parent.telegram_id = telegram_id
        parent.telegram_username = username
        parent.save(update_fields=["telegram_id", "telegram_username"])

        link_token.telegram_id = telegram_id
        link_token.telegram_username = username
        link_token.consumed = True
        link_token.save(update_fields=["telegram_id", "telegram_username", "consumed"])
        return "✅ Telegram hisobingizga ulandi. Endi bildirishnomalar shu yerga keladi."


class TelegramStatusView(APIView):
    """GET /api/auth/telegram/status/<token>/ — polled by the login page."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        login_token = get_object_or_404(TelegramLoginToken, token=token)

        if login_token.rejected:
            return Response({"status": "rejected"})

        if login_token.user is None:
            if login_token.expires_at < timezone.now():
                return Response({"status": "expired"})
            return Response({"status": "pending"})

        if login_token.consumed:
            return Response({"status": "expired"})

        login_token.consumed = True
        login_token.save(update_fields=["consumed"])

        refresh = RefreshToken.for_user(login_token.user)
        return Response(
            {
                "status": "linked",
                "is_new_user": login_token.is_new_user,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "username": login_token.user.username or "",
                "full_name": login_token.user.full_name or "",
                "telegram_username": login_token.telegram_username,
            }
        )


class TelegramCompleteView(APIView):
    """POST /api/auth/telegram/complete/ — finishes registration for a
    brand-new Telegram account (sets username/full_name/password)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        full_name = (request.data.get("full_name") or "").strip()
        password = request.data.get("password") or ""

        if not username:
            return Response({"username": ["Username kiritilishi shart"]}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response(
                {"password": ["Parol kamida 8 belgidan iborat bo'lishi kerak"]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if ParentUser.objects.exclude(id=request.user.id).filter(username=username).exists():
            return Response({"username": ["Bu username band"]}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.username = username
        user.full_name = full_name
        user.set_password(password)
        user.save(update_fields=["username", "full_name", "password"])

        return Response(ParentUserSerializer(user).data)


class TelegramLinkStartView(APIView):
    """POST /api/auth/telegram/link/start/ — an authenticated parent begins
    attaching a Telegram account to their existing login."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.telegram_id is not None:
            return Response({"detail": "Telegram allaqachon ulangan"}, status=status.HTTP_400_BAD_REQUEST)
        expires_at = timezone.now() + timedelta(minutes=settings.TELEGRAM_TOKEN_TTL_MINUTES)
        token = TelegramLoginToken.objects.create(
            expires_at=expires_at, user=request.user, is_link=True
        )
        bot_url = f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={token.token}"
        return Response({"token": str(token.token), "bot_url": bot_url}, status=status.HTTP_201_CREATED)


class TelegramLinkStatusView(APIView):
    """GET /api/auth/telegram/link/status/<token>/ — polled by the settings
    page while the parent confirms in Telegram."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, token):
        link = get_object_or_404(
            TelegramLoginToken, token=token, is_link=True, user=request.user
        )
        if link.rejected:
            return Response({"status": "rejected"})
        if link.consumed:
            return Response({"status": "linked"})
        if link.expires_at < timezone.now():
            return Response({"status": "expired"})
        return Response({"status": "pending"})


class TelegramUnlinkView(APIView):
    """POST /api/auth/telegram/unlink/ — detach Telegram from this account."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        user.telegram_id = None
        user.telegram_username = ""
        user.save(update_fields=["telegram_id", "telegram_username"])
        return Response({"status": "unlinked"})
