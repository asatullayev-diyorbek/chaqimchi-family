from django.core.management.base import BaseCommand

from apps.accounts.models import ParentUser
from apps.devices.models import Child, ChildDevice


class Command(BaseCommand):
    help = "Print every parent account with a quick status summary."

    def handle(self, *args, **options):
        hdr = f"{'kim':<24}{'tg_id':<13}{'telefon':<15}{'gate':<6}{'esl':<5}{'farz':<6}{'qurl':<6}{'ro‘yxatdan'}"
        self.stdout.write(hdr)
        self.stdout.write("-" * len(hdr))
        for u in ParentUser.objects.all().order_by("created_at"):
            kids = Child.objects.filter(family_id=u.family_id).count()
            devs = ChildDevice.objects.filter(
                family_id=u.family_id, status=ChildDevice.STATUS_LINKED
            ).count()
            who = f"@{u.telegram_username}" if u.telegram_username else (u.email or f"id{u.id}")
            self.stdout.write(
                f"{who:<24}{str(u.telegram_id or ''):<13}{u.phone or '-':<15}"
                f"{('ha' if u.onboarding_required else '-'):<6}"
                f"{u.onboarding_reminders_sent:<5}{kids:<6}{devs:<6}"
                f"{u.created_at:%Y-%m-%d %H:%M}"
            )
        total = ParentUser.objects.count()
        with_phone = ParentUser.objects.exclude(phone="").count()
        gated = ParentUser.objects.filter(onboarding_required=True).count()
        self.stdout.write("-" * len(hdr))
        self.stdout.write(
            self.style.SUCCESS(
                f"jami={total}  telefonli={with_phone}  gate_ochiq={gated}"
            )
        )
