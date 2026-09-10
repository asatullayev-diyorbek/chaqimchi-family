import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Family(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)


class Subscription(models.Model):
    """One row per family. Every family gets a free "beta" plan on creation;
    the model exists now so paid tiers (and Payme/Click billing) can be added
    later without a schema rethink. Feature checks go through ``allows()``."""

    PLAN_BETA = "beta"
    PLAN_CHOICES = [
        (PLAN_BETA, "Beta (bepul)"),
        # later: ("family", "Oila"), ("pro", "Pro")
    ]
    # Per-plan capability map. `None` = unlimited. AI analysis is off for
    # everyone for now ("tez kunda") regardless of plan.
    PLAN_FEATURES = {
        PLAN_BETA: {
            "max_children": None,
            "max_devices": None,
            "screenshots": True,
            "ai_analysis": False,
        },
    }

    STATUS_ACTIVE = "active"
    STATUS_EXPIRED = "expired"
    STATUS_CANCELED = "canceled"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_CANCELED, "Canceled"),
    ]

    family = models.OneToOneField(Family, on_delete=models.CASCADE, related_name="subscription")
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default=PLAN_BETA)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    started_at = models.DateTimeField(auto_now_add=True)
    renews_at = models.DateTimeField(null=True, blank=True)   # null = doesn't renew (beta)
    expires_at = models.DateTimeField(null=True, blank=True)  # null = no expiry
    provider = models.CharField(max_length=30, blank=True, default="")     # e.g. "payme", "click"
    provider_ref = models.CharField(max_length=120, blank=True, default="")

    def features(self) -> dict:
        return self.PLAN_FEATURES.get(self.plan, self.PLAN_FEATURES[self.PLAN_BETA])

    def allows(self, feature: str) -> bool:
        return bool(self.features().get(feature))

    @property
    def plan_label(self) -> str:
        return dict(self.PLAN_CHOICES).get(self.plan, self.plan)

    def __str__(self):
        return f"{self.family_id} · {self.plan} ({self.status})"


@receiver(post_save, sender=Family)
def _ensure_subscription(sender, instance, created, **kwargs):
    """Every family has exactly one Subscription — created here so no call
    site (managers, admin, migrations, tests) has to remember to make one."""
    if created:
        Subscription.objects.get_or_create(family=instance)


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
            # A Telegram-created account can't do anything until the parent
            # confirms a phone number through the bot (see apps.accounts.onboarding).
            onboarding_required=True,
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
    # Verified via Telegram's request_contact button during bot onboarding.
    phone = models.CharField(max_length=20, blank=True, default="")
    # True while a Telegram-origin account still owes a phone number. The
    # dashboard (web + Mini App) shows a "finish in the bot" gate instead of
    # the app while this is set; cleared when a valid contact arrives.
    onboarding_required = models.BooleanField(default=False)
    onboarding_reminders_sent = models.PositiveSmallIntegerField(default=0)
    last_onboarding_reminder_at = models.DateTimeField(null=True, blank=True)
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
