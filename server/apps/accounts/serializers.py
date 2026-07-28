from rest_framework import serializers

from .models import ParentUser


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = ParentUser
        fields = ["email", "password"]

    def create(self, validated_data):
        return ParentUser.objects.create_user(**validated_data)


class ParentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParentUser
        fields = ["id", "email", "family", "created_at"]
