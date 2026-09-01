"""Runs once a day (PA scheduled task): Telegram digest of yesterday's
activity to every linked parent who hasn't opted out."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import Family, ParentUser
from apps.accounts.telegram import send_text
from apps.alerts.models import NotificationPreference
from apps.tracking.digest import build_family_digest


class Command(BaseCommand):
    help = "Send yesterday's activity digest to Telegram-linked parents."

    def handle(self, *args, **options):
        yesterday = (timezone.localtime(timezone.now()) - timedelta(days=1)).date()
        families = Family.objects.filter(parents__telegram_id__isnull=False).distinct()

        sent = 0
        for family in families:
            text = build_family_digest(family, yesterday)
            if not text:
                continue
            parents = ParentUser.objects.filter(family=family, telegram_id__isnull=False)
            opted_out = set(
                NotificationPreference.objects.filter(
                    parent__in=parents, alert_type="daily_digest", via_telegram=False
                ).values_list("parent_id", flat=True)
            )
            for parent in parents:
                if parent.id in opted_out:
                    continue
                send_text(parent.telegram_id, text)
                sent += 1

        self.stdout.write(self.style.SUCCESS(f"Digest sent to {sent} parent(s) for {yesterday}"))
