from django.utils import timezone

from django.core.management.base import BaseCommand

from apps.accounts.models import ParentUser
from apps.devices.models import ChildDevice
from apps.tracking.models import Event


class Command(BaseCommand):
    help = "Group linked devices by family, flag ones that never synced or went silent."

    def handle(self, *args, **options):
        now = timezone.now()
        families = {}
        for d in ChildDevice.objects.filter(status=ChildDevice.STATUS_LINKED).select_related("child"):
            families.setdefault(d.family_id, []).append(d)

        stale_cutoff = now - timezone.timedelta(hours=6)

        for family_id, devices in families.items():
            owner = ParentUser.objects.filter(family_id=family_id).first()
            owner_label = "-"
            if owner:
                owner_label = f"@{owner.telegram_username}" if owner.telegram_username else (owner.email or str(owner.id))

            # Only print families with more than one device, or any device
            # that's linked but silent (never synced, or stale >6h).
            problems = [
                d for d in devices
                if d.last_sync is None or d.last_sync < stale_cutoff
            ]
            if len(devices) <= 1 and not problems:
                continue

            self.stdout.write(f"\n== family {family_id}  owner={owner_label}  devices={len(devices)} ==")
            for d in devices:
                who = (d.child.name if d.child_id else "") or d.child_name or "-"
                ev = Event.objects.filter(device=d).count()
                if d.last_sync is None:
                    sync_s = "HECH QACHON sinxronlanmagan"
                else:
                    age_h = (now - d.last_sync).total_seconds() / 3600
                    sync_s = f"{d.last_sync:%Y-%m-%d %H:%M} ({age_h:.1f}h oldin)"
                    if age_h > 6:
                        sync_s += "  <-- JIM"
                self.stdout.write(
                    f"  id={str(d.id)[:8]} child_name={who!r:<16} agent={d.agent_version or '-':<10} "
                    f"hw={d.hardware_id[:10] or '-':<11} events={ev:<6} linked_at={d.linked_at} "
                    f"last_sync={sync_s}"
                )
