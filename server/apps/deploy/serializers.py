from rest_framework import serializers

from .models import AgentVersion


class AgentVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentVersion
        fields = ["version", "binary_url"]
