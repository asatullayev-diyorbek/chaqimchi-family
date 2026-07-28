import secrets
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChildDevice, EnrollmentCode
from .serializers import (
    GenerateCodeResponseSerializer,
    VerifyCodeSerializer,
)

CODE_TTL_MINUTES = 10


def _generate_unique_code():
    while True:
        code = f"{secrets.randbelow(1_000_000):06d}"
        if not EnrollmentCode.objects.filter(used=False, code=code).exists():
            return code


class GenerateCodeView(APIView):
    """POST /api/enroll/generate-code/ — called by the installer, no auth."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        device = ChildDevice.objects.create(
            child_name=request.data.get("device_hint", "")
        )
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
            }
        ).data
        return Response(data, status=status.HTTP_201_CREATED)


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

        device = enrollment_code.device
        device.family = request.user.family
        device.status = ChildDevice.STATUS_LINKED
        device.linked_at = timezone.now()
        device.save()

        enrollment_code.used = True
        enrollment_code.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"enroll_{device.id}",
            {"type": "enroll.linked", "event": "linked"},
        )

        return Response({"device_id": device.id, "status": device.status})
