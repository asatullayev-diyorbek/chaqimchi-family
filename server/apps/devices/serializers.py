from rest_framework import serializers

from .models import ChildDevice, EnrollmentCode


class GenerateCodeResponseSerializer(serializers.Serializer):
    device_id = serializers.UUIDField(source="device.id")
    code = serializers.CharField()
    qr_payload = serializers.CharField()
    expires_at = serializers.DateTimeField()


class VerifyCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6, min_length=6)


class ChildDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChildDevice
        fields = ["id", "family", "child_name", "status", "created_at", "linked_at"]


class ChildDeviceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChildDevice
        fields = ["id", "child_name", "status", "last_sync"]
