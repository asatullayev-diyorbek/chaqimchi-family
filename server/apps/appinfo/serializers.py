from rest_framework import serializers

from .models import AppInfo


class AppInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppInfo
        fields = ["key", "display_name", "category", "description", "benefits", "risks", "age_note", "created_at"]
