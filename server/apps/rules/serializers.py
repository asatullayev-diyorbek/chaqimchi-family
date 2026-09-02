from rest_framework import serializers

from .models import RULE_TYPES, Rule


class RuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rule
        fields = ["id", "device", "rule_type", "value", "created_at"]
        read_only_fields = ["id", "device", "created_at"]

    def validate_rule_type(self, value):
        if value not in RULE_TYPES:
            raise serializers.ValidationError(f"rule_type {RULE_TYPES} dan biri bo'lishi kerak")
        return value

    def validate(self, attrs):
        rule_type = attrs.get("rule_type")
        value = attrs.get("value")
        if rule_type == "daily_limit_minutes":
            if not isinstance(value, dict) or not isinstance(value.get("minutes"), int):
                raise serializers.ValidationError(
                    {"value": "daily_limit_minutes uchun {'minutes': <int>} kerak"}
                )
            weekend = value.get("weekend_minutes")
            if weekend is not None and (not isinstance(weekend, int) or isinstance(weekend, bool)):
                raise serializers.ValidationError(
                    {"value": "weekend_minutes butun son bo'lishi kerak"}
                )
        elif rule_type == "blocked_app":
            if not isinstance(value, dict) or not value.get("app"):
                raise serializers.ValidationError(
                    {"value": "blocked_app uchun {'app': '<name>'} kerak"}
                )
        elif rule_type == "blocked_window":
            if not isinstance(value, dict) or not _is_hhmm(value.get("start")) or not _is_hhmm(value.get("end")):
                raise serializers.ValidationError(
                    {"value": "blocked_window uchun {'start': 'HH:MM', 'end': 'HH:MM'} kerak"}
                )
            if value["start"] == value["end"]:
                raise serializers.ValidationError(
                    {"value": "blocked_window: boshlanish va tugash vaqti bir xil bo'lmasligi kerak"}
                )
        return attrs


def _is_hhmm(value):
    if not isinstance(value, str):
        return False
    parts = value.split(":")
    if len(parts) != 2 or not all(p.isdigit() for p in parts):
        return False
    hh, mm = int(parts[0]), int(parts[1])
    return 0 <= hh <= 23 and 0 <= mm <= 59
