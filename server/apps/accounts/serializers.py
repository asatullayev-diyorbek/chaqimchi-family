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
    telegram_linked = serializers.SerializerMethodField()

    class Meta:
        model = ParentUser
        fields = [
            "id",
            "email",
            "username",
            "full_name",
            "telegram_username",
            "telegram_linked",
            "has_password",
            "family",
            "created_at",
        ]
        read_only_fields = [
            "id", "email", "username", "telegram_username", "family", "created_at",
        ]

    has_password = serializers.SerializerMethodField()

    def get_telegram_linked(self, obj):
        return obj.telegram_id is not None

    def get_has_password(self, obj):
        return obj.has_usable_password()
