from django.core.management.base import BaseCommand

from apps.accounts import tg_api
from apps.accounts.models import ParentUser
from apps.accounts.onboarding import _phone_keyboard

MESSAGE = (
    "Spino24 xavfsizligini oshirish uchun endi telefon raqami kerak.\n\n"
    "Hisobingizni saqlab qolish va yordam ko'rsatish uchun pastdagi "
    "«📱 Telefon raqamni yuborish» tugmasini bosing. Bu bir marta."
)


class Command(BaseCommand):
    help = "One-off: ask already-linked Telegram parents (no phone) to send their number."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        parents = ParentUser.objects.filter(
            telegram_id__isnull=False, phone="", onboarding_required=True
        )
        sent = 0
        for p in parents:
            if options["dry_run"]:
                self.stdout.write(f"would notify {p.telegram_id} (@{p.telegram_username})")
                continue
            tg_api.send_message(p.telegram_id, MESSAGE, reply_markup=_phone_keyboard())
            sent += 1
        self.stdout.write(self.style.SUCCESS(f"notified={sent} total={parents.count()}"))
