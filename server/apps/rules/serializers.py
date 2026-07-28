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
        elif rule_type == "blocked_app":
            if not isinstance(value, dict) or not value.get("app"):
                raise serializers.ValidationError(
                    {"value": "blocked_app uchun {'app': '<name>'} kerak"}
                )
        return attrs
