"""Telegram Mini App (Web App) auto-login.

Unlike the deep-link + poll flow in telegram.py (built for a plain browser
tab), a Mini App is opened *inside* Telegram, which hands the page a signed
``initData`` string. We verify that signature against the bot token and mint
JWTs directly — no confirmation prompt, because Telegram has already
authenticated the user and the signature proves the payload is untampered.

Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ParentUser

# Reject an initData payload older than this. Telegram's own recommendation is
# ~24h; the Mini App refreshes initData on every open, so a day is generous.
MAX_AUTH_AGE_SECONDS = 24 * 60 * 60


def _verify_init_data(init_data: str, bot_token: str) -> dict | None:
    """Return the parsed fields if the signature checks out, else None."""
    if not init_data or not bot_token:
        return None

    # parse_qsl keeps the values percent-decoded, which is what the check
    # string is built from. Duplicate keys aren't expected here.
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        return None

    auth_date = pairs.get("auth_date")
    try:
        if auth_date and time.time() - int(auth_date) > MAX_AUTH_AGE_SECONDS:
            return None
    except (TypeError, ValueError):
        return None

    return pairs


class TelegramWebAppLoginView(APIView):
    """POST /api/auth/telegram/webapp/ — {init_data: "<raw initData string>"}.

    Verifies the Telegram Mini App signature and returns JWTs for the matching
    ParentUser, creating one on first open. Same response shape as the
    telegram/status/ "linked" branch so the client can reuse it.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not settings.TELEGRAM_BOT_TOKEN:
            return Response(
                {"detail": "Telegram bot sozlanmagan"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        init_data = request.data.get("init_data") or request.data.get("initData") or ""
        fields = _verify_init_data(init_data, settings.TELEGRAM_BOT_TOKEN)
        if fields is None:
            return Response(
                {"detail": "Telegram imzosi tekshiruvdan o'tmadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            tg_user = json.loads(fields.get("user") or "{}")
        except json.JSONDecodeError:
            tg_user = {}
        telegram_id = tg_user.get("id")
        if not telegram_id:
            return Response(
                {"detail": "Telegram foydalanuvchi ma'lumoti topilmadi"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = (tg_user.get("username") or "").strip()
        full_name = " ".join(
            part for part in [tg_user.get("first_name"), tg_user.get("last_name")] if part
        ).strip()

        user = ParentUser.objects.filter(telegram_id=telegram_id).first()
        is_new_user = user is None
        if user is None:
            user = ParentUser.objects.create_telegram_user(
                telegram_id=telegram_id,
                telegram_username=username,
                full_name=full_name,
            )
        else:
            updates = []
            if username and user.telegram_username != username:
                user.telegram_username = username
                updates.append("telegram_username")
            if full_name and not user.full_name:
                user.full_name = full_name
                updates.append("full_name")
            if updates:
                user.save(update_fields=updates)

        sub = getattr(user.family, "subscription", None)
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "status": "linked",
                "is_new_user": is_new_user,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "username": user.username or "",
                "full_name": user.full_name or "",
                "telegram_username": user.telegram_username or "",
                "phone": user.phone or "",
                # True until the parent sends a phone number through the bot;
                # the Mini App shows a "finish in the bot" gate meanwhile.
                "onboarding_required": user.onboarding_required,
                "plan": sub.plan if sub is not None else "beta",
            }
        )
