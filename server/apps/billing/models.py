import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone

from apps.accounts.models import Family, Subscription

# One "billing period" everywhere — a month, exactly. Not a calendar month
# (see apps.tracking.digest's identical note for RANGE_DAYS): simpler, and
# what "oylik" means to a parent paying by the month.
BILLING_PERIOD_DAYS = 30


class Invoice(models.Model):
    """One purchase attempt for one paid plan. Payme/Click both drive this
    through the same state machine: pending -> paid (webhook confirms the
    payment) or canceled/failed. `activate()` is the only place a
    Subscription actually changes plan — called once, from the provider
    webhook, after that provider's own state machine confirms the money
    moved.
    """

    PROVIDER_PAYME = "payme"
    PROVIDER_CLICK = "click"
    PROVIDER_CHOICES = [(PROVIDER_PAYME, "Payme"), (PROVIDER_CLICK, "Click")]

    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_CANCELED = "canceled"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Kutilmoqda"),
        (STATUS_PAID, "To'landi"),
        (STATUS_CANCELED, "Bekor qilindi"),
        (STATUS_FAILED, "Xatolik"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    family = models.ForeignKey(Family, on_delete=models.CASCADE, related_name="invoices")
    # The plan being purchased — a Subscription.PLAN_* value at creation
    # time, kept even if PLAN_PRICE_UZS changes later (so old invoices show
    # what was actually charged, not today's price).
    plan = models.CharField(max_length=20)
    amount_uzs = models.PositiveIntegerField()
    period_days = models.PositiveIntegerField(default=BILLING_PERIOD_DAYS)

    provider = models.CharField(max_length=10, choices=PROVIDER_CHOICES)
    # The provider's own transaction id (Payme: `id` param; Click:
    # `click_trans_id`) — this is what their webhook calls key off, so it
    # must be unique per provider once set.
    provider_transaction_id = models.CharField(max_length=64, blank=True, db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    # Last webhook payload seen for this invoice — not used by any logic,
    # kept purely so a real payment dispute can be debugged from the DB
    # instead of PA's log file.
    last_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["provider", "provider_transaction_id"], name="invoice_provider_txn_idx"),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.family_id} · {self.plan} · {self.amount_uzs} so'm ({self.status})"

    def mark_paid(self):
        """Idempotent: calling this twice (a retried webhook) must not
        double-extend the subscription."""
        if self.status == self.STATUS_PAID:
            return
        now = timezone.now()
        self.status = self.STATUS_PAID
        self.paid_at = now
        self.save(update_fields=["status", "paid_at"])

        sub = self.family.subscription
        # Renewing the same plan before it expires extends from the current
        # expiry, not from "now" — a parent who pays a week early doesn't
        # lose that week.
        base = now
        if sub.expires_at and sub.expires_at > now and sub.plan == self.plan:
            base = sub.expires_at
        expires = base + timedelta(days=self.period_days)

        sub.plan = self.plan
        sub.status = Subscription.STATUS_ACTIVE
        sub.provider = self.provider
        sub.provider_ref = self.provider_transaction_id
        sub.expires_at = expires
        sub.renews_at = expires
        sub.save(update_fields=["plan", "status", "provider", "provider_ref", "expires_at", "renews_at"])

    def mark_canceled(self):
        if self.status == self.STATUS_PAID:
            # A completed payment being reversed (Payme allows cancelling a
            # performed transaction within its refund window) — downgrade
            # the family back to Beta rather than leave them on a plan they
            # got refunded for.
            sub = self.family.subscription
            if sub.provider_ref == self.provider_transaction_id:
                sub.plan = Subscription.PLAN_BETA
                sub.status = Subscription.STATUS_CANCELED
                sub.save(update_fields=["plan", "status"])
        self.status = self.STATUS_CANCELED
        self.canceled_at = timezone.now()
        self.save(update_fields=["status", "canceled_at"])


def expire_subscriptions() -> int:
    """Downgrade every paid subscription whose expires_at has passed back to
    Beta. Shared by the management command and the cron HTTP endpoint (PA
    Free has no scheduled tasks — see apps.tracking.digest for the same
    pattern)."""
    now = timezone.now()
    qs = Subscription.objects.exclude(plan=Subscription.PLAN_BETA).filter(expires_at__lt=now)
    count = qs.count()
    qs.update(plan=Subscription.PLAN_BETA, status=Subscription.STATUS_EXPIRED)
    return count
