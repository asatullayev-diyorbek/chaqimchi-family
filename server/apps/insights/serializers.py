from rest_framework import serializers

from .models import WeeklyInsight


class WeeklyInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyInsight
        fields = ["week_start", "summary", "highlights", "recommendations", "risk_level", "created_at"]
