from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import ParentUser, Subscription


class Command(BaseCommand):
    help = "Set a family's subscription plan by hand (e.g. granting the unlimited tester plan)."

    def add_arguments(self, parser):
        parser.add_argument("--telegram-id", type=int, required=True)
        parser.add_argument("--plan", type=str, required=True, choices=[c for c, _ in Subscription.PLAN_CHOICES])

    def handle(self, *args, **options):
        try:
            user = ParentUser.objects.get(telegram_id=options["telegram_id"])
        except ParentUser.DoesNotExist:
            raise CommandError(f"no ParentUser with telegram_id={options['telegram_id']}")

        sub = user.family.subscription
        sub.plan = options["plan"]
        sub.status = Subscription.STATUS_ACTIVE
        sub.expires_at = None
        sub.renews_at = None
        sub.save()

        self.stdout.write(self.style.SUCCESS(
            f"family={user.family_id} telegram_id={user.telegram_id} -> plan={sub.plan}"
        ))
