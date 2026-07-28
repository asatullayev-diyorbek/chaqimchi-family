from rest_framework import serializers


class IngestSerializer(serializers.Serializer):
    device_id = serializers.UUIDField()
    batch_id = serializers.CharField(max_length=64)
    events = serializers.ListField(child=serializers.DictField(), allow_empty=True)


class TopAppSerializer(serializers.Serializer):
    app = serializers.CharField()
    minutes = serializers.IntegerField()


class SummarySerializer(serializers.Serializer):
    device_id = serializers.UUIDField()
    date = serializers.DateField()
    total_screen_minutes = serializers.IntegerField()
    top_apps = TopAppSerializer(many=True)
    device_status = serializers.CharField()
    last_sync = serializers.DateTimeField(allow_null=True)
