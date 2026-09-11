from django.utils import timezone

from django.core.management.base import BaseCommand

from apps.devices.models import ChildDevice
from apps.tracking.models import Event, EventBatch


class Command(BaseCommand):
    help = "Print every linked device with its last sync / event activity."

    def handle(self, *args, **options):
        now = timezone.now()
        hdr = f"{'child':<14}{'platform':<10}{'status':<10}{'agent':<10}{'last_sync':<20}{'events':<8}{'last_batch':<20}{'linked_at'}"
        self.stdout.write(hdr)
        self.stdout.write("-" * len(hdr))
        for d in ChildDevice.objects.all().select_related("child").order_by("-linked_at"):
            who = (d.child.name if d.child_id else "") or d.child_name or "-"
            last_sync = d.last_sync.strftime("%Y-%m-%d %H:%M") if d.last_sync else "-"
            ago = ""
            if d.last_sync:
                mins = (now - d.last_sync).total_seconds() / 60
                ago = f" ({int(mins)}m)" if mins < 120 else f" ({int(mins/60)}h)"
            event_count = Event.objects.filter(device=d).count()
            last_batch = EventBatch.objects.filter(device=d).order_by("-received_at").first()
            last_batch_s = last_batch.received_at.strftime("%Y-%m-%d %H:%M") if last_batch else "-"
            linked = d.linked_at.strftime("%Y-%m-%d %H:%M") if d.linked_at else "-"
            self.stdout.write(
                f"{who:<14}{d.platform:<10}{d.status:<10}{(d.agent_version or '-'):<10}"
                f"{(last_sync+ago):<20}{event_count:<8}{last_batch_s:<20}{linked}"
            )
