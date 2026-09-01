"""GET/PUT /api/notifications/preferences/ — the parent's Telegram
notification settings: connection status + a per-alert-type toggle."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser

from .models import ALERT_LABELS, ALERT_TYPES, NotificationPreference


class NotificationPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(self._payload(request.user))

    def put(self, request):
        parent = request.user
        if not isinstance(parent, ParentUser):
            return Response(status=status.HTTP_403_FORBIDDEN)

        items = request.data.get("alerts") or []
        by_type = {}
        for item in items:
            t = item.get("alert_type")
            if t in ALERT_TYPES:
                by_type[t] = bool(item.get("via_telegram", True))

        for alert_type, on in by_type.items():
            NotificationPreference.objects.update_or_create(
                parent=parent, alert_type=alert_type, defaults={"via_telegram": on}
            )
        return Response(self._payload(parent))

    @staticmethod
    def _payload(parent):
        overrides = {
            p.alert_type: p.via_telegram
            for p in NotificationPreference.objects.filter(parent=parent)
        }
        return {
            "telegram": {
                "linked": parent.telegram_id is not None,
                "username": parent.telegram_username or "",
            },
            "alerts": [
                {
                    "alert_type": t,
                    "label": ALERT_LABELS.get(t, t),
                    "via_telegram": overrides.get(t, True),
                }
                for t in ALERT_TYPES
            ],
        }
