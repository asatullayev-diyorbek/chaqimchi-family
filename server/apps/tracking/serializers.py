from rest_framework import serializers


class IngestSerializer(serializers.Serializer):
    device_id = serializers.UUIDField()
    batch_id = serializers.CharField(max_length=64)
    events = serializers.ListField(child=serializers.DictField(), allow_empty=True)
