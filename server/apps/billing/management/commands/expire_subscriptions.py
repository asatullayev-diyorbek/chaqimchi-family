from django.core.management.base import BaseCommand

from apps.billing.models import expire_subscriptions


class Command(BaseCommand):
    help = "Downgrade paid subscriptions whose expires_at has passed back to Beta."

    def handle(self, *args, **options):
        count = expire_subscriptions()
        self.stdout.write(self.style.SUCCESS(f"downgraded={count}"))
