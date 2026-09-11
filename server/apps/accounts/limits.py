"""Plan-limit checks shared by the views that create children/devices —
kept out of apps.devices so that app doesn't need to import apps.accounts
models beyond what it already does, and so the "which plan allows what"
logic lives in one place next to the Subscription model it reads."""

from rest_framework.exceptions import APIException
from rest_framework import status


class PlanLimitExceeded(APIException):
    status_code = status.HTTP_402_PAYMENT_REQUIRED
    default_code = "plan_limit_exceeded"


def _subscription(family):
    return getattr(family, "subscription", None)


def assert_can_add_child(family):
    sub = _subscription(family)
    if sub is None:
        return
    limit = sub.limit("max_children")
    if limit is None:
        return
    from apps.devices.models import Child

    if Child.objects.filter(family=family).count() >= limit:
        raise PlanLimitExceeded(
            f"«{sub.plan_label}» tarifida {limit} tagacha farzand qo'shish mumkin. "
            "Ko'proq uchun tarifni oshiring."
        )


def assert_can_add_device(family):
    sub = _subscription(family)
    if sub is None:
        return
    limit = sub.limit("max_devices")
    if limit is None:
        return
    from apps.devices.models import ChildDevice

    if ChildDevice.objects.filter(family=family, status=ChildDevice.STATUS_LINKED).count() >= limit:
        raise PlanLimitExceeded(
            f"«{sub.plan_label}» tarifida {limit} tagacha qurilma ulash mumkin. "
            "Ko'proq uchun tarifni oshiring."
        )
