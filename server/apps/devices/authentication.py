from django.contrib.auth.hashers import check_password
from rest_framework import authentication, exceptions

from .models import ChildDevice


class DeviceSecretAuthentication(authentication.BaseAuthentication):
    """Authorization: Device <device_id>:<device_secret>

    Used by the agent (not a ParentUser) to call device-scoped endpoints
    like tracking ingest. On success, request.user is the ChildDevice
    instance itself (with is_authenticated=True bolted on so DRF's
    IsAuthenticated permission works unmodified).
    """

    keyword = "Device"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header or not header.startswith(f"{self.keyword} "):
            return None

        credentials = header[len(self.keyword) + 1 :]
        try:
            device_id, device_secret = credentials.split(":", 1)
        except ValueError:
            raise exceptions.AuthenticationFailed("Noto'g'ri Authorization format")

        try:
            device = ChildDevice.objects.get(id=device_id)
        except (ChildDevice.DoesNotExist, ValueError):
            raise exceptions.AuthenticationFailed("Qurilma topilmadi")

        if device.device_secret != device_secret:
            raise exceptions.AuthenticationFailed("Noto'g'ri device_secret")

        device.is_authenticated = True
        return (device, None)
