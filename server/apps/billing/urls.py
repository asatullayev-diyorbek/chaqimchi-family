from django.urls import path

from .views import (
    BillingStatusView,
    CheckoutView,
    ClickCompleteView,
    ClickPrepareView,
    ExpireSubscriptionsView,
    PaymeWebhookView,
    PlansView,
)

urlpatterns = [
    path("plans/", PlansView.as_view(), name="billing-plans"),
    path("status/", BillingStatusView.as_view(), name="billing-status"),
    path("checkout/", CheckoutView.as_view(), name="billing-checkout"),
    path("payme/webhook/", PaymeWebhookView.as_view(), name="billing-payme-webhook"),
    path("click/prepare/", ClickPrepareView.as_view(), name="billing-click-prepare"),
    path("click/complete/", ClickCompleteView.as_view(), name="billing-click-complete"),
    path("expire/", ExpireSubscriptionsView.as_view(), name="billing-expire"),
]
