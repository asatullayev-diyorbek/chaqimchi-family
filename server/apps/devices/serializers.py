from rest_framework import serializers

from .models import ChildDevice, EnrollmentCode


class GenerateCodeResponseSerializer(serializers.Serializer):
    device_id = serializers.UUIDField(source="device.id")
    # Only returned here, to the installer running on this exact physical
    # device at provisioning time — this is the device bootstrapping its
    # own long-term credential, the same pattern as cloud instance metadata
    # self-fetch, not a general-purpose lookup. Nothing else in the API
    # exposes device_secret. Previously this field existed on ChildDevice
    # but was never actually handed to anything that needed it — the agent
    # had no way to authenticate itself until this was added (Bosqich 4.5).
    device_secret = serializers.CharField(source="device.device_secret")
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
