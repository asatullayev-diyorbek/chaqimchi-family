from rest_framework import serializers

from .models import ScreenshotRequest


class ScreenshotRequestSerializer(serializers.ModelSerializer):
    """Parent-facing view of one screenshot request. ``url`` is a short-TTL
    presigned R2 GET, present only for uploaded, non-expired rows — the view
    fills it in via the serializer context."""

    url = serializers.SerializerMethodField()

    class Meta:
        model = ScreenshotRequest
        fields = [
            "id", "device", "status", "retention",
            "created_at", "captured_at", "expires_at",
            "width", "height", "size_bytes", "error", "url",
        ]

    def get_url(self, obj):
        return (self.context.get("urls") or {}).get(obj.id)


class CreateScreenshotRequestSerializer(serializers.Serializer):
    device_id = serializers.UUIDField()
    retention = serializers.ChoiceField(
        choices=[c[0] for c in ScreenshotRequest.RETENTION_CHOICES],
        default="week",
    )


class ConfirmSerializer(serializers.Serializer):
    captured_at = serializers.DateTimeField(required=False)
    width = serializers.IntegerField(required=False, min_value=0, max_value=100_000)
    height = serializers.IntegerField(required=False, min_value=0, max_value=100_000)
    size_bytes = serializers.IntegerField(min_value=1)
    sha256 = serializers.CharField(required=False, allow_blank=True, max_length=64)


class FailedSerializer(serializers.Serializer):
    error = serializers.CharField(required=False, allow_blank=True, max_length=300)
