from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser
from apps.devices.models import ChildDevice

import logging

from .models import Alert
from .notifications import notify_parents_of_alert
from .serializers import AlertSerializer, ReportAlertSerializer

logger = logging.getLogger(__name__)


class ReportAlertView(APIView):
    """POST /api/alerts/report/ — called by the agent, device-secret authenticated."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        device = request.user
        if not isinstance(device, ChildDevice):
            return Response(
                {"detail": "Device autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = ReportAlertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        alert = Alert.objects.create(
            device=device,
            alert_type=data["alert_type"],
            payload=data.get("payload") or {},
            triggered_at=data.get("triggered_at") or timezone.now(),
        )
        try:
            notify_parents_of_alert(alert)
        except Exception:  # noqa: BLE001 - notification must not fail the report
            logger.exception("alert parent notification failed for alert %s", alert.pk)
        return Response(AlertSerializer(alert).data, status=status.HTTP_201_CREATED)


class DeviceAlertListView(APIView):
    """GET /api/alerts/<device_id>/ — parent-authenticated, tenant-isolated,
    newest first."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, device_id):
        if not isinstance(request.user, ParentUser):
            return Response(
                {"detail": "Parent autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        device = get_object_or_404(ChildDevice, id=device_id)
        if device.family_id != request.user.family_id:
            return Response(
                {"detail": "Bu qurilma sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )
        alerts = Alert.objects.filter(device=device).order_by("-triggered_at")
        return Response(AlertSerializer(alerts, many=True).data)


class MarkAlertSeenView(APIView):
    """POST /api/alerts/<alert_id>/mark-seen/ — parent-authenticated, tenant-isolated."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, alert_id):
        if not isinstance(request.user, ParentUser):
            return Response(
                {"detail": "Parent autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        alert = get_object_or_404(Alert, id=alert_id)
        if alert.device.family_id != request.user.family_id:
            return Response(
                {"detail": "Bu alert sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )
        alert.seen = True
        alert.save(update_fields=["seen"])
        return Response(AlertSerializer(alert).data)
