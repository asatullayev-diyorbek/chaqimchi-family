from rest_framework import serializers


class IngestSerializer(serializers.Serializer):
    schema_version = serializers.IntegerField(default=1, min_value=1, max_value=1)
    device_id = serializers.UUIDField()
    batch_id = serializers.CharField(max_length=64)
    sent_at = serializers.DateTimeField(required=False)
    agent = serializers.DictField(required=False, default=dict)
    events = serializers.ListField(child=serializers.DictField(), allow_empty=True)

    def validate_agent(self, value):
        allowed = {"version", "platform", "session_id"}
        unknown = set(value) - allowed
        if unknown:
            raise serializers.ValidationError(f"Noma'lum agent metadata: {', '.join(sorted(unknown))}")
        if "platform" in value and value["platform"] not in {"windows", "android", "ios"}:
            raise serializers.ValidationError("platform windows, android yoki ios bo'lishi kerak")
        return value

    def validate_events(self, events):
        for event in events:
            if not event.get("type"):
                raise serializers.ValidationError("Har bir eventda type bo'lishi kerak")
            if event.get("event_id") is not None and not isinstance(event["event_id"], str):
                raise serializers.ValidationError("event_id matn bo'lishi kerak")
        return events


class TopAppSerializer(serializers.Serializer):
    app = serializers.CharField()
    minutes = serializers.IntegerField()
    last_used_at = serializers.DateTimeField(allow_null=True)
    # data:image/png;base64,... extracted from the app's exe, or null.
    icon = serializers.CharField(allow_null=True, required=False)


class DayBreakdownSerializer(serializers.Serializer):
    date = serializers.DateField()
    total_minutes = serializers.IntegerField()


class SummarySerializer(serializers.Serializer):
    device_id = serializers.UUIDField()
    child_name = serializers.CharField(allow_blank=True, allow_null=True)
    child_birth_date = serializers.DateField(allow_null=True)
    child_photo_url = serializers.CharField(allow_blank=True, allow_null=True)
    date = serializers.DateField()
    total_screen_minutes = serializers.IntegerField()
    top_apps = TopAppSerializer(many=True)
    device_status = serializers.CharField()
    last_sync = serializers.DateTimeField(allow_null=True)
    battery_percent = serializers.IntegerField(allow_null=True)
    battery_updated_at = serializers.DateTimeField(allow_null=True)
    breakdown = DayBreakdownSerializer(many=True)


class ActivityHistorySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    event_type = serializers.CharField()
    app_name = serializers.CharField(allow_blank=True, allow_null=True)
    app_id = serializers.CharField(allow_blank=True, allow_null=True)
    icon = serializers.CharField(allow_null=True, required=False)
    started_at = serializers.DateTimeField(allow_null=True)
    ended_at = serializers.DateTimeField(allow_null=True)
    duration_seconds = serializers.IntegerField(min_value=0, allow_null=True)
    created_at = serializers.DateTimeField()
