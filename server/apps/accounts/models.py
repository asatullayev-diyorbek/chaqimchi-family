import uuid
from datetime import timedelta

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


class Family(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        parent = self.parents.order_by("created_at").first()
        return str(parent) if parent else f"Oila {str(self.id)[:8]}"


class Subscription(models.Model):
    """One row per family. Every family gets a free "beta" plan on creation —
    which is a 7-day full-feature trial (see ``TRIAL_DAYS``/``is_trial_active``),
    not a permanent free tier. Once the trial lapses, a still-``beta`` family
    falls back to ``BETA_EXPIRED_FEATURES`` until they pick Mini or Max.
    Feature checks go through ``allows()``."""

    PLAN_BETA = "beta"
    PLAN_MINI = "mini"
    PLAN_MAX = "max"
    PLAN_TESTER = "tester"
    PLAN_CHOICES = [
        (PLAN_BETA, "Beta (7 kunlik sinov)"),
        (PLAN_MINI, "Mini"),
        (PLAN_MAX, "Max"),
        (PLAN_TESTER, "Tester (cheksiz, faqat sinovchilar uchun)"),
    ]

    TRIAL_DAYS = 7

    # Monthly (1-oy) price in so'm — kept for call sites that only ever sold
    # a single period (bot menu, MRR reporting). Source of truth for the
    # actual checkout amount is ``PLAN_DURATION_PRICES`` below, which must
    # agree with this dict's 1-month entry. Tester is never sold — it's
    # assigned by hand to people helping test the product (billing.
    # CheckoutView only accepts mini/max) — so it has no real price.
    PLAN_PRICE_UZS = {
        PLAN_BETA: 0,
        PLAN_MINI: 25_000,
        PLAN_MAX: 35_000,
        PLAN_TESTER: 0,
    }

    # Duration-tiered pricing (months -> so'm) for the plans that are
    # actually sold. Longer commitments are discounted — this must match
    # marketing/src/lib/site.ts's PLANS durations; if one changes, update
    # both.
    PLAN_DURATION_PRICES = {
        PLAN_MINI: {1: 25_000, 3: 70_000, 12: 250_000},
        PLAN_MAX: {1: 35_000, 3: 95_000, 12: 350_000},
    }

    # Per-plan capability map. `None` = unlimited. PLAN_BETA here is the
    # *active-trial* shape (7 days, matching TRIAL_DAYS) — capped at 1
    # child/1 device but otherwise Max-level, so a family can fully evaluate
    # paid features before deciding. Once the trial lapses, ``features()``
    # returns BETA_EXPIRED_FEATURES instead.
    PLAN_FEATURES = {
        PLAN_BETA: {
            "max_children": 1,
            "max_devices": 1,
            "history_days": None,
            "screenshot_daily_limit": None,
            "ai_analysis": True,
        },
        PLAN_MINI: {
            "max_children": 2,
            "max_devices": 4,
            "history_days": 30,
            "screenshot_daily_limit": 10,
            "ai_analysis": False,
        },
        PLAN_MAX: {
            "max_children": 5,
            "max_devices": 10,
            "history_days": None,
            "screenshot_daily_limit": None,
            "ai_analysis": True,
        },
        PLAN_TESTER: {
            "max_children": None,
            "max_devices": None,
            "history_days": None,
            "screenshot_daily_limit": None,
            "ai_analysis": True,
        },
    }

    # Applied to a `beta` family once its trial has lapsed and it hasn't
    # picked a paid plan — deliberately tight, to make upgrading the
    # obvious next step rather than a comfortable permanent free tier.
    BETA_EXPIRED_FEATURES = {
        "max_children": 1,
        "max_devices": 1,
        "history_days": 3,
        "screenshot_daily_limit": 0,
        "ai_analysis": False,
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

    @property
    def trial_ends_at(self):
        """Trial is always measured from this Subscription row's creation —
        the same moment the family itself was created (see
        ``_ensure_subscription`` below), so no extra field is needed."""
        return self.started_at + timedelta(days=self.TRIAL_DAYS)

    @property
    def is_trial_active(self) -> bool:
        return self.plan == self.PLAN_BETA and timezone.now() < self.trial_ends_at

    def features(self) -> dict:
        if self.plan == self.PLAN_BETA and not self.is_trial_active:
            return self.BETA_EXPIRED_FEATURES
        return self.PLAN_FEATURES.get(self.plan, self.PLAN_FEATURES[self.PLAN_BETA])

    def allows(self, feature: str) -> bool:
        return bool(self.features().get(feature))

    def limit(self, feature: str):
        """Numeric cap for `feature`, or None for unlimited/unknown."""
        return self.features().get(feature)

    @property
    def price_uzs(self) -> int:
        return self.PLAN_PRICE_UZS.get(self.plan, 0)

    @classmethod
    def duration_price_uzs(cls, plan: str, months: int) -> int | None:
        """Price for `plan` billed for `months` (1/3/12), or None if that
        plan/duration combination isn't sold."""
        return cls.PLAN_DURATION_PRICES.get(plan, {}).get(months)

    @property
    def plan_label(self) -> str:
        return dict(self.PLAN_CHOICES).get(self.plan, self.plan)

    def is_paid_and_active(self) -> bool:
        return self.plan != self.PLAN_BETA and self.status == self.STATUS_ACTIVE

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

    def create_telegram_user(self, telegram_id, telegram_username="", full_name="", referred_by=None):
        user = self.model(
            family=Family.objects.create(),
            telegram_id=telegram_id,
            telegram_username=telegram_username,
            full_name=full_name,
            referred_by=referred_by,
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
    # apps.tasks referral program: who invited this parent (set once, from a
    # `/start ref_<id>` deep link, at account creation — never retroactive).
    referred_by = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="referrals"
    )
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = ParentUserManager()

    def __str__(self):
        return self.email or self.username or f"telegram:{self.telegram_id}"

    @property
    def short_id(self) -> str:
        """The apps.tasks story-verification number a parent writes on their
        reposted story — their row id, zero-padded to 4 digits (an id of 5+
        digits is used as-is, never truncated)."""
        return f"{self.id:04d}"


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

    def __str__(self):
        who = self.telegram_username or self.telegram_id or (self.user or "yangi foydalanuvchi")
        return f"Telegram token: {who}"


class PasswordResetCode(models.Model):
    """Six-digit code DM'd to a parent's linked Telegram to reset a
    forgotten password. No email — PythonAnywhere Free can't send it."""

    user = models.ForeignKey(ParentUser, on_delete=models.CASCADE, related_name="+")
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} — parol tiklash kodi"
