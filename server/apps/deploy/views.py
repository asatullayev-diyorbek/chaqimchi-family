from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.devices.models import ChildDevice

from .models import AgentVersion
from .serializers import AgentVersionSerializer


class LatestVersionView(APIView):
    """GET /api/deploy/latest/ — device-secret authenticated.

    No signature verification here — see agent/internal/updater's package
    doc for why that's a deliberate, temporary gap (internal dev-cycle
    speed per the architecture doc), not a security shortcut left in by
    accident. Bosqich 6 is where signed/verified OTA lands.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not isinstance(request.user, ChildDevice):
            return Response(
                {"detail": "Device autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        latest = AgentVersion.objects.filter(is_active=True).order_by("-released_at").first()
        if latest is None:
            return Response(
                {"detail": "Hozircha e'lon qilingan versiya yo'q"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(AgentVersionSerializer(latest).data)
