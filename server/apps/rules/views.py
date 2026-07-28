from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser
from apps.devices.models import ChildDevice

from .models import Rule
from .serializers import RuleSerializer


def _require_parent(request):
    """Returns an error Response if request.user isn't a ParentUser, else None."""
    if not isinstance(request.user, ParentUser):
        return Response(
            {"detail": "Parent autentifikatsiyasi talab qilinadi"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return None


class RuleCollectionView(APIView):
    """GET/POST /api/rules/<id>/ — <id> is a device_id here (list/create the
    device's rules). DELETE /api/rules/<id>/ — <id> is a rule_id there
    (delete that one rule). Same URL shape per the spec, disambiguated by
    HTTP method rather than by two separate paths."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        error = _require_parent(request)
        if error:
            return error
        device = get_object_or_404(ChildDevice, id=id)
        if device.family_id != request.user.family_id:
            return Response(
                {"detail": "Bu qurilma sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )
        rules = Rule.objects.filter(device=device).order_by("-created_at")
        return Response(RuleSerializer(rules, many=True).data)

    def post(self, request, id):
        error = _require_parent(request)
        if error:
            return error
        device = get_object_or_404(ChildDevice, id=id)
        if device.family_id != request.user.family_id:
            return Response(
                {"detail": "Bu qurilma sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = RuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = Rule.objects.create(device=device, **serializer.validated_data)
        return Response(RuleSerializer(rule).data, status=status.HTTP_201_CREATED)

    def delete(self, request, id):
        error = _require_parent(request)
        if error:
            return error
        rule = get_object_or_404(Rule, id=id)
        if rule.device.family_id != request.user.family_id:
            return Response(
                {"detail": "Bu qoida sizning oilangizga tegishli emas"},
                status=status.HTTP_403_FORBIDDEN,
            )
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceOwnRulesView(APIView):
    """GET /api/rules/device/ — device-secret authenticated; the agent's
    own device is inferred from the auth header, not a URL parameter."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        device = request.user
        if not isinstance(device, ChildDevice):
            return Response(
                {"detail": "Device autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        rules = Rule.objects.filter(device=device).order_by("-created_at")
        return Response(RuleSerializer(rules, many=True).data)
