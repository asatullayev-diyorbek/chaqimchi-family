import logging

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.devices.models import ChildDevice

from .models import EVENT_TYPES, Event, EventBatch
from .serializers import IngestSerializer

logger = logging.getLogger(__name__)


def _occurred_at(event: dict):
    raw = event.get("occurred_at") or event.get("started_at")
    parsed = parse_datetime(raw) if raw else None
    return parsed or timezone.now()


class IngestView(APIView):
    """POST /api/tracking/ingest/ — called by the agent, device-secret authenticated."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        device = request.user
        if not isinstance(device, ChildDevice):
            return Response(
                {"detail": "Device autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = IngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if str(data["device_id"]) != str(device.id):
            return Response(
                {"detail": "device_id autentifikatsiya qilingan qurilmaga mos kelmaydi"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if device.status != ChildDevice.STATUS_LINKED:
            return Response(
                {"detail": "Qurilma hali oilaga bog'lanmagan"},
                status=status.HTTP_403_FORBIDDEN,
            )

        batch_id = data["batch_id"]

        # Idempotency: a batch we've already stored is a no-op success —
        # the agent retries whenever it didn't see our ack, not just on error.
        if EventBatch.objects.filter(batch_id=batch_id).exists():
            return Response({"status": "ok", "duplicate": True})

        try:
            with transaction.atomic():
                batch = EventBatch.objects.create(device=device, batch_id=batch_id)
                created = 0
                skipped = 0
                for event in data["events"]:
                    event_type = event.get("type")
                    if event_type not in EVENT_TYPES:
                        logger.warning(
                            "Noma'lum event turi rad etildi: %s (device=%s, batch=%s)",
                            event_type,
                            device.id,
                            batch_id,
                        )
                        skipped += 1
                        continue
                    Event.objects.create(
                        batch=batch,
                        device=device,
                        event_type=event_type,
                        payload=event,
                        occurred_at=_occurred_at(event),
                    )
                    created += 1
        except IntegrityError:
            # Concurrent retry raced us and inserted the same batch_id first.
            return Response({"status": "ok", "duplicate": True})

        return Response(
            {"status": "ok", "events_saved": created, "events_skipped": skipped},
            status=status.HTTP_201_CREATED,
        )
