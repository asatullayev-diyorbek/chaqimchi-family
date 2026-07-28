from rest_framework import serializers

from .models import ALERT_TYPES, Alert


class ReportAlertSerializer(serializers.Serializer):
    alert_type = serializers.ChoiceField(choices=ALERT_TYPES)
    payload = serializers.DictField(required=False, default=dict)
    triggered_at = serializers.DateTimeField(required=False)


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ["id", "device", "alert_type", "payload", "triggered_at", "seen"]
