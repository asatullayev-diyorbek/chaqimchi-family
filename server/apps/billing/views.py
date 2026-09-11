import base64
import binascii

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ParentUser, Subscription

from . import click, payme
from .models import Invoice, expire_subscriptions

PAYABLE_PLANS = (Subscription.PLAN_MINI, Subscription.PLAN_MAX)


class PlansView(APIView):
    """GET /api/billing/plans/ — public plan catalogue for the apps/marketing
    site to render without duplicating prices anywhere."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(
            [
                {
                    "plan": plan,
                    "label": label,
                    "price_uzs": Subscription.PLAN_PRICE_UZS[plan],
                    "features": Subscription.PLAN_FEATURES[plan],
                }
                for plan, label in Subscription.PLAN_CHOICES
            ]
        )


class BillingStatusView(APIView):
    """GET /api/billing/status/ — the caller's current plan, usage vs limits,
    and whether Payme/Click are even wired up yet."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not isinstance(request.user, ParentUser):
            return Response({"detail": "Parent autentifikatsiyasi talab qilinadi"}, status=401)
        from apps.devices.models import Child, ChildDevice

        family = request.user.family
        sub = family.subscription
        children = Child.objects.filter(family=family).count()
        devices = ChildDevice.objects.filter(family=family, status=ChildDevice.STATUS_LINKED).count()
        return Response(
            {
                "plan": sub.plan,
                "plan_label": sub.plan_label,
                "status": sub.status,
                "expires_at": sub.expires_at,
                "usage": {
                    "children": children,
                    "children_limit": sub.limit("max_children"),
                    "devices": devices,
                    "devices_limit": sub.limit("max_devices"),
                },
                "providers_available": {
                    "payme": payme.is_configured(),
                    "click": click.is_configured(),
                },
            }
        )


class CheckoutView(APIView):
    """POST /api/billing/checkout/ {plan, provider} — queues an Invoice and
    returns the URL to send the parent to."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not isinstance(request.user, ParentUser):
            return Response({"detail": "Parent autentifikatsiyasi talab qilinadi"}, status=401)

        plan = request.data.get("plan")
        provider = request.data.get("provider")
        if plan not in PAYABLE_PLANS:
            return Response({"detail": "Noto'g'ri tarif"}, status=status.HTTP_400_BAD_REQUEST)
        if provider not in (Invoice.PROVIDER_PAYME, Invoice.PROVIDER_CLICK):
            return Response({"detail": "Noto'g'ri to'lov usuli"}, status=status.HTTP_400_BAD_REQUEST)
        if provider == Invoice.PROVIDER_PAYME and not payme.is_configured():
            return Response({"detail": "Payme hali ulanmagan"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if provider == Invoice.PROVIDER_CLICK and not click.is_configured():
            return Response({"detail": "Click hali ulanmagan"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        invoice = Invoice.objects.create(
            family=request.user.family,
            plan=plan,
            amount_uzs=Subscription.PLAN_PRICE_UZS[plan],
            provider=provider,
        )
        url = payme.checkout_url(invoice) if provider == Invoice.PROVIDER_PAYME else click.checkout_url(invoice)
        return Response(
            {"invoice_id": invoice.id, "amount_uzs": invoice.amount_uzs, "checkout_url": url},
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_exempt, name="dispatch")
class PaymeWebhookView(APIView):
    """POST /api/billing/payme/webhook/ — Payme's single JSON-RPC endpoint.
    Auth: HTTP Basic "Paycom:<merchant key>", not DRF auth."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        if not payme.is_configured() or not self._authorized(request):
            return JsonResponse(
                {"error": {"code": -32504, "message": "Not authorized"}}, status=200
            )
        return JsonResponse(payme.handle(request.data))

    @staticmethod
    def _authorized(request) -> bool:
        header = request.headers.get("Authorization", "")
        if not header.startswith("Basic "):
            return False
        try:
            decoded = base64.b64decode(header[6:]).decode()
        except (binascii.Error, UnicodeDecodeError):
            return False
        login, _, key = decoded.partition(":")
        return login == "Paycom" and key == settings.PAYME_MERCHANT_KEY


@method_decorator(csrf_exempt, name="dispatch")
class ClickPrepareView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        if not click.is_configured():
            return JsonResponse({"error": -8, "error_note": "Click sozlanmagan"})
        return JsonResponse(click.prepare(request.data))


@method_decorator(csrf_exempt, name="dispatch")
class ClickCompleteView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        if not click.is_configured():
            return JsonResponse({"error": -8, "error_note": "Click sozlanmagan"})
        return JsonResponse(click.complete(request.data))


class ExpireSubscriptionsView(APIView):
    """POST /api/billing/expire/ — external cron (X-Digest-Secret, same
    shared secret as the daily digest / onboarding reminders)."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get("X-Digest-Secret", "") or request.query_params.get("secret", "")
        if not settings.DIGEST_CRON_SECRET or secret != settings.DIGEST_CRON_SECRET:
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        return Response({"downgraded": expire_subscriptions()})
