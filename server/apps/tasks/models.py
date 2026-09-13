from django.db import models
from django.utils import timezone

from apps.accounts.models import Family, ParentUser


class Task(models.Model):
    """A growth task a parent can complete for a wallet reward. One row per
    type — created via the admin, not user-facing CRUD. `channel_username`
    is only meaningful for TYPE_CHANNEL_JOIN (e.g. "@spino24uz").
    `target_url` is only meaningful for the two story types — the
    channel/profile a parent should repost a post from (e.g.
    "https://t.me/spino24uz" or "https://www.instagram.com/spino24.uz")."""

    TYPE_CHANNEL_JOIN = "channel_join"
    TYPE_REFERRAL = "referral"
    TYPE_INSTAGRAM_STORY = "instagram_story"
    TYPE_TELEGRAM_STORY = "telegram_story"
    TYPE_CHOICES = [
        (TYPE_CHANNEL_JOIN, "Kanalga a'zolik"),
        (TYPE_REFERRAL, "Do'stni taklif qilish"),
        (TYPE_INSTAGRAM_STORY, "Instagram'da story"),
        (TYPE_TELEGRAM_STORY, "Telegram'da story"),
    ]

    # Story types are always admin-reviewed (a parent reposts one of our
    # channel/profile posts to their own story with their 4-digit id written
    # on it — nothing here is machine-verifiable). Only channel_join
    # resolves automatically, via getChatMember; referral resolves as a
    # side effect of the referred friend's channel_join.
    STORY_TYPES = (TYPE_TELEGRAM_STORY, TYPE_INSTAGRAM_STORY)

    type = models.CharField(max_length=20, choices=TYPE_CHOICES, unique=True)
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    reward_uzs = models.PositiveIntegerField(default=1000)
    is_active = models.BooleanField(default=True)
    channel_username = models.CharField(max_length=60, blank=True, default="")
    target_url = models.URLField(blank=True, default="")

    def __str__(self):
        return f"{self.title} ({self.reward_uzs:,} coin)".replace(",", " ")


class TaskCompletion(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Kutilmoqda"),
        (STATUS_APPROVED, "Tasdiqlandi"),
        (STATUS_REJECTED, "Rad etildi"),
    ]

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="completions")
    parent = models.ForeignKey(ParentUser, on_delete=models.CASCADE, related_name="task_completions")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    note = models.CharField(max_length=200, blank=True, default="")  # e.g. a rejection reason
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.CharField(max_length=150, blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["task", "parent"], name="one_completion_per_task_per_parent")
        ]
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.parent} · {self.task.title} · {self.status}"

    def approve(self, reviewed_by: str = ""):
        if self.status == self.STATUS_APPROVED:
            return
        self.status = self.STATUS_APPROVED
        self.reviewed_at = timezone.now()
        self.reviewed_by = reviewed_by
        self.save(update_fields=["status", "reviewed_at", "reviewed_by"])
        Wallet.objects.get_or_create(family=self.parent.family)[0].credit(
            self.task.reward_uzs, f"Vazifa: {self.task.title}"
        )

    def reject(self, reviewed_by: str = "", note: str = ""):
        self.status = self.STATUS_REJECTED
        self.reviewed_at = timezone.now()
        self.reviewed_by = reviewed_by
        self.note = note
        self.save(update_fields=["status", "reviewed_at", "reviewed_by", "note"])


class Wallet(models.Model):
    """One per family — an internal credit balance, redeemable only as a
    discount at subscription checkout (see apps.billing.views.CheckoutView).
    Never withdrawn as real money, so no KYC/payout machinery is needed."""

    family = models.OneToOneField(Family, on_delete=models.CASCADE, related_name="wallet")
    balance_uzs = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.family_id} · {self.balance_uzs:,} coin".replace(",", " ")

    def credit(self, amount_uzs: int, reason: str):
        if amount_uzs <= 0:
            return
        self.balance_uzs = models.F("balance_uzs") + amount_uzs
        self.save(update_fields=["balance_uzs"])
        self.refresh_from_db(fields=["balance_uzs"])
        WalletTransaction.objects.create(wallet=self, amount_uzs=amount_uzs, reason=reason)

    def debit(self, amount_uzs: int, reason: str):
        """Caller must ensure amount_uzs <= balance_uzs — used only at
        checkout, where the amount is always clamped to the balance first."""
        if amount_uzs <= 0:
            return
        self.balance_uzs = models.F("balance_uzs") - amount_uzs
        self.save(update_fields=["balance_uzs"])
        self.refresh_from_db(fields=["balance_uzs"])
        WalletTransaction.objects.create(wallet=self, amount_uzs=-amount_uzs, reason=reason)


class WalletTransaction(models.Model):
    """Append-only ledger — positive amount_uzs is a credit (task reward),
    negative is a debit (checkout redemption). Never mutated after creation,
    so the balance is always independently re-derivable for an audit."""

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name="transactions")
    amount_uzs = models.IntegerField()
    reason = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.wallet_id} · {self.amount_uzs:+,} coin · {self.reason}".replace(",", " ")
