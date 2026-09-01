from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .telegram import (
    TelegramCompleteView,
    TelegramLinkStartView,
    TelegramLinkStatusView,
    TelegramStartView,
    TelegramUnlinkView,
    TelegramStatusView,
    TelegramWebhookView,
)
from .views import LoginView, MeView, SignupView

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("login/refresh/", TokenRefreshView.as_view(), name="login-refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("telegram/start/", TelegramStartView.as_view(), name="telegram-start"),
    path("telegram/webhook/", TelegramWebhookView.as_view(), name="telegram-webhook"),
    path("telegram/status/<uuid:token>/", TelegramStatusView.as_view(), name="telegram-status"),
    path("telegram/complete/", TelegramCompleteView.as_view(), name="telegram-complete"),
    path("telegram/link/start/", TelegramLinkStartView.as_view(), name="telegram-link-start"),
    path("telegram/link/status/<uuid:token>/", TelegramLinkStatusView.as_view(), name="telegram-link-status"),
    path("telegram/unlink/", TelegramUnlinkView.as_view(), name="telegram-unlink"),
]
