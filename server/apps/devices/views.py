import secrets
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import models, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.limits import assert_can_add_child, assert_can_add_device
from apps.accounts.models import ParentUser

from .icons import get_or_create_icon_blob
from .models import Child, ChildDevice, EnrollmentCode, InstalledApp
from .serializers import (
    ChildDeviceListSerializer,
    ChildSerializer,
    GenerateCodeResponseSerializer,
    InstalledAppSerializer,
    InstalledAppSyncSerializer,
    VerifyCodeSerializer,
)

CODE_TTL_MINUTES = 10


class ChildListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChildSerializer
    def get_queryset(self):
        if not isinstance(self.request.user, ParentUser): return Child.objects.none()
        return Child.objects.filter(family=self.request.user.family).annotate(device_count=models.Count("devices"))
    def perform_create(self, serializer):
        assert_can_add_child(self.request.user.family)
        serializer.save(family=self.request.user.family)


class ChildDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChildSerializer
    lookup_field = "id"
    def get_queryset(self):
        if not isinstance(self.request.user, ParentUser): return Child.objects.none()
        return Child.objects.filter(family=self.request.user.family).annotate(device_count=models.Count("devices"))


def _generate_unique_code():
    while True:
        code = f"{secrets.randbelow(1_000_000):06d}"
        if not EnrollmentCode.objects.filter(used=False, code=code).exists():
            return code


class GenerateCodeView(APIView):
    """POST /api/enroll/generate-code/ — called by the installer, no auth."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        device_hint = request.data.get("device_hint", "")
        hardware_id = (request.data.get("hardware_id") or "").strip()[:64]

        device, previously_linked = self._device_for(hardware_id, device_hint)

        code = _generate_unique_code()
        expires_at = timezone.now() + timedelta(minutes=CODE_TTL_MINUTES)
        enrollment_code = EnrollmentCode.objects.create(
            device=device,
            code=code,
            qr_payload=f"chaqimchi://enroll?token={code}",
            expires_at=expires_at,
        )
        data = GenerateCodeResponseSerializer(
            {
                "device": device,
                "code": enrollment_code.code,
                "qr_payload": enrollment_code.qr_payload,
                "expires_at": enrollment_code.expires_at,
                "previously_linked": previously_linked,
            }
        ).data
        return Response(data, status=status.HTTP_201_CREATED)

    @staticmethod
    def _device_for(hardware_id, device_hint):
        """Reuse this machine's existing device row when it's safe to — i.e.
        when the fingerprint matches a device that isn't currently linked to
        an account. If it matches a *linked* device we hand out a fresh row
        (so re-running our installer can never move someone else's active
        device to a new account) but flag previously_linked so the wizard
        can tell the operator the old entry stays behind."""
        if hardware_id:
            match = (
                ChildDevice.objects.filter(hardware_id=hardware_id)
                .order_by("-created_at")
                .first()
            )
            if match is not None:
                if match.status == ChildDevice.STATUS_UNLINKED or match.family_id is None:
                    match.device_secret = secrets.token_hex()
                    if device_hint:
                        match.child_name = device_hint
                    match.save(update_fields=["device_secret", "child_name"])
                    EnrollmentCode.objects.filter(device=match, used=False).update(used=True)
                    return match, False
                return (
                    ChildDevice.objects.create(child_name=device_hint, hardware_id=hardware_id),
                    True,
                )
        return ChildDevice.objects.create(child_name=device_hint, hardware_id=hardware_id), False


class VerifyCodeView(APIView):
    """POST /api/enroll/verify-code/ — called by the mobile app, parent-authenticated."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code_value = serializer.validated_data["code"]

        try:
            enrollment_code = EnrollmentCode.objects.select_related("device").get(
                code=code_value, used=False
            )
        except EnrollmentCode.DoesNotExist:
            return Response(
                {"detail": "Kod topilmadi yoki muddati tugagan"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if enrollment_code.expires_at < timezone.now():
            return Response(
                {"detail": "Kod topilmadi yoki muddati tugagan"},
                status=status.HTTP_410_GONE,
            )

        assert_can_add_device(request.user.family)

        device = enrollment_code.device
        child_id = request.data.get("child_id")
        if not child_id:
            assert_can_add_child(request.user.family)
        with transaction.atomic():
            child = get_object_or_404(Child, id=child_id, family=request.user.family) if child_id else Child.objects.create(family=request.user.family, name=device.child_name or "Farzand")

            # A child may have several devices linked at once (laptop, phone,
            # tablet). Pairing a new one used to silently retire the others,
            # which meant a parent adding a second computer watched the first
            # one disappear from the dashboard along with its data.
            device.family = request.user.family
            device.child = child
            device.child_name = child.name
            device.status = ChildDevice.STATUS_LINKED
            device.linked_at = timezone.now()
            device.save(update_fields=["family", "child", "child_name", "status", "linked_at"])

            enrollment_code.used = True
            enrollment_code.save(update_fields=["used"])

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"enroll_{device.id}",
            {"type": "enroll.linked", "event": "linked"},
        )

        from apps.accounts.notify_admin import notify_new_device

        notify_new_device(device)

        return Response({"device_id": device.id, "status": device.status})


class EnrollmentStatusView(APIView):
    """GET /api/enroll/status/<device_id>/ — polled by the installer while it
    waits for the parent app to link the device.

    No auth: same trust model as generate-code (the installer holds only the
    device_id it was just handed, not a parent credential). This exists
    because the installer previously waited on a WebSocket
    (ws/enroll/<device_id>/), which PythonAnywhere's WSGI-only hosting
    cannot serve — polling this REST endpoint works on any WSGI host.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, device_id):
        device = get_object_or_404(ChildDevice, id=device_id)
        return Response({"status": device.status})


class DeviceListView(generics.ListAPIView):
    """GET /api/devices/ — the current parent's own family's devices."""

    serializer_class = ChildDeviceListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not isinstance(user, ParentUser):
            return ChildDevice.objects.none()
        return ChildDevice.objects.filter(family=user.family).select_related("child")


class DeviceDetailView(APIView):
    """PATCH/DELETE /api/devices/<id>/ — parent-authenticated, tenant-isolated.

    PATCH renames (child_name only). DELETE unlinks — sets family=None and
    status back to "unlinked" — rather than hard-deleting the row, since
    apps.tracking.Event/EventBatch and apps.alerts.Alert all FK to
    ChildDevice and their history should survive an unlink (e.g. re-linking
    the same physical device later, or a parent wanting old records after
    disconnecting it).
    """

    permission_classes = [permissions.IsAuthenticated]

    def _get_owned_device(self, request, id):
        if not isinstance(request.user, ParentUser):
            return None, Response(
                {"detail": "Parent autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        device = get_object_or_404(ChildDevice, id=id)
        if device.family_id != request.user.family_id:
            return None, Response(
                {"detail": "Bu qurilma sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return device, None

    def patch(self, request, id):
        device, error = self._get_owned_device(request, id)
        if error:
            return error
        updated = []
        child_name = request.data.get("child_name")
        if child_name is not None:
            device.child_name = child_name
            updated.append("child_name")
        if "child_id" in request.data:
            child_id = request.data.get("child_id")
            if child_id:
                child = get_object_or_404(Child, id=child_id, family=request.user.family)
                device.child = child
                device.child_name = child.name
                updated += ["child", "child_name"]
            else:
                device.child = None
                updated.append("child")
        if updated:
            device.save(update_fields=list(dict.fromkeys(updated)))
        return Response(ChildDeviceListSerializer(device).data)

    def delete(self, request, id):
        device, error = self._get_owned_device(request, id)
        if error:
            return error
        device.family = None
        device.status = ChildDevice.STATUS_UNLINKED
        device.save(update_fields=["family", "status"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstalledAppsListView(APIView):
    """GET /api/devices/<id>/installed-apps/ — parent-authenticated,
    tenant-isolated, same ownership check as DeviceDetailView."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        if not isinstance(request.user, ParentUser):
            return Response(
                {"detail": "Parent autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        device = get_object_or_404(ChildDevice, id=id)
        if device.family_id != request.user.family_id:
            return Response(
                {"detail": "Bu qurilma sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )
        apps = InstalledApp.objects.filter(device=device)
        return Response(InstalledAppSerializer(apps, many=True).data)


class InstalledAppsSyncView(APIView):
    """POST /api/devices/<id>/installed-apps/sync/ — device-secret
    authenticated. The agent sends its full current inventory; this upserts
    each entry and deletes whatever isn't in the payload anymore, since
    InstalledApp is a snapshot, not an event log."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        device = request.user
        if not isinstance(device, ChildDevice) or str(device.id) != str(id):
            return Response(
                {"detail": "Device autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if device.status != ChildDevice.STATUS_LINKED:
            return Response(
                {"detail": "Qurilma hali oilaga bog'lanmagan"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = InstalledAppSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        apps = serializer.validated_data["apps"]

        with transaction.atomic():
            seen_names = []
            for entry in apps:
                seen_names.append(entry["name"])
                defaults = {
                    "version": entry.get("version") or "",
                    "publisher": entry.get("publisher") or "",
                    "install_date": entry.get("install_date"),
                    # Reappearing after being marked uninstalled means a
                    # reinstall — clear the mark rather than leave a
                    # stale uninstalled_at on a currently-installed app.
                    "uninstalled_at": None,
                }
                # Icon extraction can fail on the agent's side (unreadable
                # DisplayIcon path, etc.) — only overwrite a previously-good
                # icon when this sync actually resolved a new one.
                blob = get_or_create_icon_blob(entry.get("sha256"), entry.get("icon_b64") or "")
                if blob is not None:
                    defaults["icon"] = blob
                InstalledApp.objects.update_or_create(
                    device=device, name=entry["name"], defaults=defaults,
                )
            # Missing from this snapshot but not already marked: just
            # uninstalled. Never hard-delete — a parent should still be able
            # to see what used to be there and when it went away.
            InstalledApp.objects.filter(device=device, uninstalled_at__isnull=True).exclude(
                name__in=seen_names
            ).update(uninstalled_at=timezone.now())

        return Response({"status": "ok", "count": len(seen_names)})
