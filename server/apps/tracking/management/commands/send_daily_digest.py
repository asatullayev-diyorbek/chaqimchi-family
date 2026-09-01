"""Telegram digest of yesterday's activity to every linked, opted-in parent.
Idempotent per date. Runnable by hand; the deployment triggers it through
POST /api/tracking/digest/run/ (PythonAnywhere Free has no scheduled tasks)."""

from django.core.management.base import BaseCommand

from apps.tracking.digest import run_daily_digest


class Command(BaseCommand):
    help = "Send yesterday's activity digest to Telegram-linked parents."

    def handle(self, *args, **options):
        already, sent = run_daily_digest()
        if already:
            self.stdout.write(self.style.WARNING("Digest already sent for that date."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Digest sent to {sent} parent(s)."))
