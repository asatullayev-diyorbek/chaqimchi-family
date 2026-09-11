from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import ParentUser


class Command(BaseCommand):
    help = "Grant Django admin (staff+superuser) access to an existing ParentUser, setting email/password."

    def add_arguments(self, parser):
        parser.add_argument("--telegram-id", type=int, required=True)
        parser.add_argument("--email", type=str, required=True)
        parser.add_argument("--password", type=str, required=True)

    def handle(self, *args, **options):
        try:
            user = ParentUser.objects.get(telegram_id=options["telegram_id"])
        except ParentUser.DoesNotExist:
            raise CommandError(f"no ParentUser with telegram_id={options['telegram_id']}")

        user.email = options["email"]
        user.is_staff = True
        user.is_superuser = True
        user.set_password(options["password"])
        user.save()

        self.stdout.write(self.style.SUCCESS(
            f"granted admin: telegram_id={user.telegram_id} email={user.email} "
            f"is_staff={user.is_staff} is_superuser={user.is_superuser}"
        ))
