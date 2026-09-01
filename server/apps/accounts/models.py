import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class Family(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)


class ParentUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        if "family" not in extra_fields:
            extra_fields["family"] = Family.objects.create()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)

    def create_telegram_user(self, telegram_id, telegram_username="", full_name=""):
        user = self.model(
            family=Family.objects.create(),
            telegram_id=telegram_id,
            telegram_username=telegram_username,
            full_name=full_name,
        )
        user.set_unusable_password()
        user.save(using=self._db)
        return user


class ParentUser(AbstractBaseUser, PermissionsMixin):
    family = models.ForeignKey(
        Family, on_delete=models.CASCADE, related_name="parents"
    )
    email = models.EmailField(unique=True, null=True, blank=True)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=150, blank=True, default="")
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    telegram_username = models.CharField(max_length=150, blank=True, default="")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = ParentUserManager()

    def __str__(self):
        return self.email or self.username or f"telegram:{self.telegram_id}"


class TelegramLoginToken(models.Model):
    """One-time token used to bridge a browser tab and a Telegram /start deep
    link — see TelegramStartView/TelegramWebhookView/TelegramStatusView in
    telegram.py. Mirrors apps.devices.models.EnrollmentCode's shape, which
    solves the same "short-lived pairing code" problem for device enrollment.
    """

    token = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    user = models.ForeignKey(
        ParentUser, on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )
    is_new_user = models.BooleanField(default=False)
    # is_link tokens are created by an already-authenticated parent to attach
    # a Telegram account to their existing login, rather than to sign in.
    is_link = models.BooleanField(default=False)
    telegram_id = models.BigIntegerField(null=True, blank=True)
    telegram_username = models.CharField(max_length=150, blank=True, default="")
    consumed = models.BooleanField(default=False)
    rejected = models.BooleanField(default=False)


class PasswordResetCode(models.Model):
    """Six-digit code DM'd to a parent's linked Telegram to reset a
    forgotten password. No email — PythonAnywhere Free can't send it."""

    user = models.ForeignKey(ParentUser, on_delete=models.CASCADE, related_name="+")
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
