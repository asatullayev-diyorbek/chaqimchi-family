from django.core.management.base import BaseCommand

from apps.accounts.onboarding import run_onboarding_reminders


class Command(BaseCommand):
    help = "Nudge Telegram-origin parents who haven't sent a phone number yet."

    def handle(self, *args, **options):
        result = run_onboarding_reminders()
        self.stdout.write(
            self.style.SUCCESS(
                f"checked={result['checked']} reminded={result['reminded']}"
            )
        )
