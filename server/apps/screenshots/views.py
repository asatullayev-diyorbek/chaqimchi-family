"""Screenshot command-queue endpoints.

Parent side (JWT):
  POST   /api/screenshots/request/          queue a capture
  GET    /api/screenshots/?device_id=<id>   list this device's screenshots
  DELETE /api/screenshots/<id>/             delete one now

Agent side (Device <id>:<secret>):
  GET    /api/screenshots/pending/          claim work
  POST   /api/screenshots/<id>/upload-url/  get a presigned R2 PUT
  POST   /api/screenshots/<id>/confirm/     report a finished upload
  POST   /api/screenshots/<id>/failed/      report a failure

Cron (shared secret):
  POST   /api/screenshots/cleanup/          delete expired images
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser
from apps.devices.models import ChildDevice

from . import r2
from .models import ScreenshotCleanupRun, ScreenshotRequest
from .serializers import (
    ConfirmSerializer,
    CreateScreenshotRequestSerializer,
    FailedSerializer,
    ScreenshotRequestSerializer,
)

logger = logging.getLogger(__name__)

RATE_PER_HOUR = getattr(settings, "SCREENSHOT_RATE_PER_HOUR", 6)
MAX_BYTES = getattr(settings, "SCREENSHOT_MAX_BYTES", 8 * 1024 * 1024)
# How many rows a parent's list endpoint returns (newest first).
LIST_LIMIT = 60


def _parent_device(request, device_id):
    """(device, None) if the caller is a parent who owns device_id, else
    (None, error Response). Mirrors tracking._owned_device."""
    if not isinstance(request.user, ParentUser):
        return None, Response(
            {"detail": "Parent autentifikatsiyasi talab qilinadi"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    device = get_object_or_404(ChildDevice, id=device_id)
    if device.family_id != request.user.family_id:
        return None, Response(
            {"detail": "Bu qurilma sizning oilangizga tegishli emas"},
            status=status.HTTP_403_FORBIDDEN,
        )
    return device, None


def _auth_device(request):
    """The ChildDevice from a Device auth header, or (None, error Response)."""
    device = request.user
    if not isinstance(device, ChildDevice):
        return None, Response(
            {"detail": "Device autentifikatsiyasi talab qilinadi"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return device, None


def _storage_ready():
    if r2.is_configured():
        return None
    return Response(
        {"detail": "Skrinshot xizmati hali sozlanmagan"},
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


class RequestScreenshotView(APIView):
    """POST /api/screenshots/request/ — parent queues a capture."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        not_ready = _storage_ready()
        if not_ready:
            return not_ready

        serializer = CreateScreenshotRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        device, error = _parent_device(request, data["device_id"])
        if error:
            return error
        if device.status != ChildDevice.STATUS_LINKED:
            return Response(
                {"detail": "Qurilma oilaga bog'lanmagan"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        window_start = timezone.now() - timedelta(hours=1)
        recent = ScreenshotRequest.objects.filter(
            device=device, created_at__gte=window_start
        ).count()
        if recent >= RATE_PER_HOUR:
            return Response(
                {"detail": f"Soatiga {RATE_PER_HOUR} martadan ko'p so'rab bo'lmaydi"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Plan quota — counted per family (not per device) since the
        # subscription is family-level; None means unlimited (Max).
        sub = getattr(device.family, "subscription", None)
        daily_limit = sub.limit("screenshot_daily_limit") if sub else None
        if daily_limit is not None:
            day_start = timezone.now() - timedelta(hours=24)
            used_today = ScreenshotRequest.objects.filter(
                device__family_id=device.family_id, created_at__gte=day_start
            ).count()
            if used_today >= daily_limit:
                return Response(
                    {
                        "detail": (
                            f"Kunlik limit tugadi ({daily_limit} ta) — "
                            f"«{sub.plan_label}» tarifda shuncha. Ko'proq uchun tarifni oshiring."
                        ),
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        shot = ScreenshotRequest.objects.create(
            device=device,
            requested_by=request.user,
            retention=data["retention"],
        )
        online = bool(
            device.last_sync
            and timezone.now() - device.last_sync <= timedelta(minutes=5)
        )
        body = ScreenshotRequestSerializer(shot).data
        body["device_online"] = online
        return Response(body, status=status.HTTP_201_CREATED)


class ListScreenshotsView(APIView):
    """GET /api/screenshots/?device_id=<id> — parent lists a device's shots."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        device_id = request.query_params.get("device_id")
        if not device_id:
            return Response(
                {"detail": "device_id talab qilinadi"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        device, error = _parent_device(request, device_id)
        if error:
            return error

        now = timezone.now()
        rows = list(
            ScreenshotRequest.objects.filter(device=device)
            .exclude(status=ScreenshotRequest.STATUS_EXPIRED)
            .exclude(expires_at__lt=now)  # retention passed — image is gone
            .order_by("-created_at")[:LIST_LIMIT]
        )
        # Presign only the rows a viewer can actually open.
        urls = {}
        if r2.is_configured():
            for row in rows:
                if (
                    row.status == ScreenshotRequest.STATUS_UPLOADED
                    and row.r2_key
                    and (row.expires_at is None or row.expires_at > now)
                ):
                    try:
                        urls[row.id] = r2.presigned_get(row.r2_key)
                    except Exception:  # noqa: BLE001 - never fail the list over one URL
                        logger.exception("presign GET failed for %s", row.id)

        data = ScreenshotRequestSerializer(
            rows, many=True, context={"urls": urls}
        ).data
        return Response({"results": data, "count": len(data)})


class ScreenshotDetailView(APIView):
    """DELETE /api/screenshots/<id>/ — parent removes one image now."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, id):
        if not isinstance(request.user, ParentUser):
            return Response(
                {"detail": "Parent autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        shot = get_object_or_404(ScreenshotRequest, id=id)
        if shot.device.family_id != request.user.family_id:
            return Response(
                {"detail": "Bu skrinshot sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )
        if shot.r2_key and r2.is_configured():
            try:
                r2.delete_keys([shot.r2_key])
            except Exception:  # noqa: BLE001
                logger.exception("R2 delete failed for %s", shot.id)
        shot.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PendingScreenshotsView(APIView):
    """GET /api/screenshots/pending/ — agent claims queued captures for its
    own device (inferred from the Device auth header)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        device, error = _auth_device(request)
        if error:
            return error
        pending = ScreenshotRequest.objects.filter(
            device=device,
            status__in=[
                ScreenshotRequest.STATUS_PENDING,
                ScreenshotRequest.STATUS_CAPTURING,
            ],
        ).order_by("created_at")[:5]
        return Response(
            {
                "results": [
                    {"id": str(s.id), "retention": s.retention, "status": s.status}
                    for s in pending
                ]
            }
        )


class _AgentShotView(APIView):
    """Base for the agent's per-request callbacks: resolves the row and
    checks it belongs to the authenticated device."""

    permission_classes = [permissions.IsAuthenticated]

    def _shot(self, request, id):
        device, error = _auth_device(request)
        if error:
            return None, error
        shot = get_object_or_404(ScreenshotRequest, id=id)
        if shot.device_id != device.id:
            return None, Response(
                {"detail": "Bu so'rov boshqa qurilmaga tegishli"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return shot, None


class UploadUrlView(_AgentShotView):
    """POST /api/screenshots/<id>/upload-url/ — hand the agent a presigned PUT."""

    def post(self, request, id):
        not_ready = _storage_ready()
        if not_ready:
            return not_ready
        shot, error = self._shot(request, id)
        if error:
            return error
        if shot.status in (
            ScreenshotRequest.STATUS_UPLOADED,
            ScreenshotRequest.STATUS_EXPIRED,
        ):
            return Response(
                {"detail": "So'rov allaqachon yakunlangan"},
                status=status.HTTP_409_CONFLICT,
            )
        shot.r2_key = shot.storage_key()
        shot.status = ScreenshotRequest.STATUS_CAPTURING
        shot.save(update_fields=["r2_key", "status"])
        try:
            url = r2.presigned_put(shot.r2_key)
        except Exception:  # noqa: BLE001
            logger.exception("presign PUT failed for %s", shot.id)
            return Response(
                {"detail": "Yuklash havolasini yaratib bo'lmadi"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {"upload_url": url, "key": shot.r2_key, "max_bytes": MAX_BYTES}
        )


class ConfirmView(_AgentShotView):
    """POST /api/screenshots/<id>/confirm/ — agent reports a finished upload."""

    def post(self, request, id):
        shot, error = self._shot(request, id)
        if error:
            return error
        serializer = ConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["size_bytes"] > MAX_BYTES:
            return Response(
                {"detail": "Rasm hajmi juda katta"},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        shot.mark_uploaded(
            captured_at=data.get("captured_at"),
            width=data.get("width"),
            height=data.get("height"),
            size_bytes=data["size_bytes"],
            sha256=data.get("sha256", ""),
        )
        return Response({"status": shot.status, "expires_at": shot.expires_at})


class FailedView(_AgentShotView):
    """POST /api/screenshots/<id>/failed/ — agent couldn't capture / upload."""

    def post(self, request, id):
        shot, error = self._shot(request, id)
        if error:
            return error
        serializer = FailedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shot.status = ScreenshotRequest.STATUS_FAILED
        shot.error = serializer.validated_data.get("error", "")[:300]
        shot.save(update_fields=["status", "error"])
        return Response({"status": shot.status})


class CleanupView(APIView):
    """POST /api/screenshots/cleanup/ — external cron (cron-job.org), same
    shared-secret pattern as the daily digest. Deletes R2 objects and rows
    whose retention window has passed, and expires requests the agent never
    claimed (device offline). Naturally idempotent."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get("X-Screenshots-Secret", "") or request.query_params.get(
            "secret", ""
        )
        expected = getattr(settings, "SCREENSHOTS_CRON_SECRET", "")
        if not expected or secret != expected:
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        expired = list(
            ScreenshotRequest.objects.filter(
                status=ScreenshotRequest.STATUS_UPLOADED, expires_at__lt=now
            )
        )
        unclaimed = list(
            ScreenshotRequest.objects.filter(
                status__in=[
                    ScreenshotRequest.STATUS_PENDING,
                    ScreenshotRequest.STATUS_CAPTURING,
                ],
                created_at__lt=now - ScreenshotRequest.UNCLAIMED_TTL,
            )
        )

        keys = [s.r2_key for s in expired + unclaimed if s.r2_key]
        deleted = 0
        if keys and r2.is_configured():
            try:
                deleted = r2.delete_keys(keys)
            except Exception:  # noqa: BLE001
                logger.exception("R2 batch delete failed during cleanup")

        ScreenshotRequest.objects.filter(id__in=[s.id for s in expired]).delete()
        ScreenshotRequest.objects.filter(id__in=[s.id for s in unclaimed]).update(
            status=ScreenshotRequest.STATUS_EXPIRED,
            error="Qurilma javob bermadi",
        )

        run = ScreenshotCleanupRun.objects.create(
            expired_count=len(expired),
            unclaimed_count=len(unclaimed),
            objects_deleted=deleted,
        )
        return Response(
            {
                "expired": run.expired_count,
                "unclaimed": run.unclaimed_count,
                "objects_deleted": run.objects_deleted,
            }
        )
