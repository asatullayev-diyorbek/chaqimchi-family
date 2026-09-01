"""Account self-service: change your password, and reset a forgotten one
through the Telegram bot (no email — PythonAnywhere Free can't send it)."""

import secrets
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ParentUser, PasswordResetCode
from .telegram import send_text

RESET_TTL_MINUTES = 15
MAX_ATTEMPTS = 5


class PasswordChangeView(APIView):
    """POST /api/auth/password/change/ — {old_password?, new_password}.
    old_password is required only when the account already has one (a
    Telegram-only account sets its first password here)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        new = request.data.get("new_password") or ""
        if len(new) < 8:
            return Response({"new_password": ["Kamida 8 ta belgi"]}, status=status.HTTP_400_BAD_REQUEST)
        if user.has_usable_password():
            if not user.check_password(request.data.get("old_password") or ""):
                return Response({"old_password": ["Joriy parol noto'g'ri"]}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new)
        user.save(update_fields=["password"])
        return Response({"status": "ok"})


class PasswordResetStartView(APIView):
    """POST /api/auth/password/reset/start/ — {username}. If that account has
    a linked Telegram, DM it a 6-digit code. Always 200 (don't leak whether
    the account exists or has Telegram)."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = (request.data.get("username") or request.data.get("email") or "").strip()
        user = ParentUser.objects.filter(
            Q(username=identifier) | Q(email=identifier)
        ).first() if identifier else None

        if user and user.telegram_id:
            PasswordResetCode.objects.filter(user=user, used=False).update(used=True)
            code = f"{secrets.randbelow(1_000_000):06d}"
            PasswordResetCode.objects.create(
                user=user, code=code,
                expires_at=timezone.now() + timedelta(minutes=RESET_TTL_MINUTES),
            )
            send_text(
                user.telegram_id,
                f"ChaqimchiAI Guard — parolni tiklash kodi: {code}\n"
                f"{RESET_TTL_MINUTES} daqiqa amal qiladi. Bu siz bo'lmasangiz, e'tiborsiz qoldiring.",
            )
        return Response({"status": "ok"})


class PasswordResetVerifyView(APIView):
    """POST /api/auth/password/reset/verify/ — {username, code, new_password}."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = (request.data.get("username") or request.data.get("email") or "").strip()
        code = (request.data.get("code") or "").strip()
        new = request.data.get("new_password") or ""

        if len(new) < 8:
            return Response({"new_password": ["Kamida 8 ta belgi"]}, status=status.HTTP_400_BAD_REQUEST)

        user = ParentUser.objects.filter(Q(username=identifier) | Q(email=identifier)).first()
        entry = (
            PasswordResetCode.objects.filter(
                user=user, used=False, expires_at__gt=timezone.now()
            ).order_by("-created_at").first()
            if user
            else None
        )
        if entry is None:
            return Response({"detail": "Kod topilmadi yoki muddati tugagan"}, status=status.HTTP_400_BAD_REQUEST)

        entry.attempts += 1
        if entry.attempts > MAX_ATTEMPTS:
            entry.used = True
            entry.save(update_fields=["used", "attempts"])
            return Response({"detail": "Juda ko'p urinish. Qaytadan boshlang."}, status=status.HTTP_400_BAD_REQUEST)
        if entry.code != code:
            entry.save(update_fields=["attempts"])
            return Response({"detail": "Kod noto'g'ri"}, status=status.HTTP_400_BAD_REQUEST)

        entry.used = True
        entry.save(update_fields=["used", "attempts"])
        user.set_password(new)
        user.save(update_fields=["password"])
        return Response({"status": "ok"})
