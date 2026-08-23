from rest_framework import serializers

from .models import Child, ChildDevice, EnrollmentCode


class ChildSerializer(serializers.ModelSerializer):
    device_count = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    photo = serializers.FileField(required=False, allow_null=True)
    def get_device_count(self, obj):
        return getattr(obj, "device_count", obj.devices.count())
    class Meta:
        model = Child
        fields = ["id", "name", "birth_date", "photo", "photo_url", "created_at", "device_count"]
    def get_photo_url(self, obj):
        if not obj.photo:
            return ""
        return obj.photo.url

    def validate_photo(self, value):
        if value is None:
            return value
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Rasm hajmi 5 MB dan oshmasligi kerak.")
        header = value.read(12)
        value.seek(0)
        valid = header.startswith(b"\x89PNG\r\n\x1a\n") or header.startswith(b"\xff\xd8\xff") or (header[:4] == b"RIFF" and header[8:12] == b"WEBP")
        if not valid:
            raise serializers.ValidationError("Faqat PNG, JPG yoki WEBP rasm fayli qabul qilinadi.")
        return value

    def update(self, instance, validated_data):
        old_photo = instance.photo
        new_photo = validated_data.get("photo", old_photo)
        instance = super().update(instance, validated_data)
        if old_photo and new_photo != old_photo:
            old_photo.delete(save=False)
        return instance


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
    child_id = serializers.SerializerMethodField()
    child_name = serializers.SerializerMethodField()
    def get_child_id(self, obj):
        return obj.child_id
    def get_child_name(self, obj):
        return obj.child.name if obj.child_id else obj.child_name
    class Meta:
        model = ChildDevice
        fields = ["id", "child_id", "child_name", "platform", "status", "created_at", "linked_at", "last_sync"]
