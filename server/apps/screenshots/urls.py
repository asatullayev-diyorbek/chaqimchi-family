from django.urls import path

from .views import (
    CleanupView,
    ConfirmView,
    FailedView,
    ListScreenshotsView,
    PendingScreenshotsView,
    RequestScreenshotView,
    ScreenshotDetailView,
    UploadUrlView,
)

urlpatterns = [
    path("request/", RequestScreenshotView.as_view(), name="screenshot-request"),
    path("pending/", PendingScreenshotsView.as_view(), name="screenshot-pending"),
    path("cleanup/", CleanupView.as_view(), name="screenshot-cleanup"),
    path("<uuid:id>/upload-url/", UploadUrlView.as_view(), name="screenshot-upload-url"),
    path("<uuid:id>/confirm/", ConfirmView.as_view(), name="screenshot-confirm"),
    path("<uuid:id>/failed/", FailedView.as_view(), name="screenshot-failed"),
    path("<uuid:id>/", ScreenshotDetailView.as_view(), name="screenshot-detail"),
    path("", ListScreenshotsView.as_view(), name="screenshot-list"),
]
