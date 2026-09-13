from django.core.management.base import BaseCommand

from apps.accounts import tg_api
from apps.accounts.models import ParentUser, Subscription
from apps.accounts.onboarding import img, miniapp_url

MESSAGE = (
    "⭐ Spino24'ni baholang!\n\n"
    "Ilova sizga qanday yordam berayotgani haqida fikringiz biz uchun muhim — "
    "bir necha soniya vaqt ajratib, 1 dan 5 gacha baho bering, xohlasangiz izoh ham qoldiring."
)


class Command(BaseCommand):
    help = (
        "DMs every Telegram-linked parent (or just PLAN_TESTER families, with "
        "--testers-only) an inline button that opens the in-app review sheet."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--testers-only", action="store_true", help="Only message PLAN_TESTER families."
        )
        parser.add_argument(
            "--dry-run", action="store_true", help="Print who would be messaged, without sending."
        )

    def handle(self, *args, **options):
        parents = ParentUser.objects.filter(telegram_id__isnull=False)
        if options["testers_only"]:
            parents = parents.filter(family__subscription__plan=Subscription.PLAN_TESTER)
        parents = parents.distinct()

        button = {
            "inline_keyboard": [
                [{"text": "⭐ Baholash", "web_app": {"url": f"{miniapp_url()}?open=review"}}]
            ]
        }

        total = parents.count()
        sent = 0
        for parent in parents:
            if options["dry_run"]:
                self.stdout.write(f"would send to {parent} (telegram_id={parent.telegram_id})")
                continue
            result = tg_api.send_photo(
                parent.telegram_id, img("review-request"), caption=MESSAGE, reply_markup=button
            )
            if result and result.get("ok"):
                sent += 1
            else:
                self.stdout.write(self.style.WARNING(f"failed to send to {parent}"))

        if options["dry_run"]:
            self.stdout.write(self.style.SUCCESS(f"dry-run: would message {total} parent(s)"))
        else:
            self.stdout.write(self.style.SUCCESS(f"sent={sent} total={total}"))
