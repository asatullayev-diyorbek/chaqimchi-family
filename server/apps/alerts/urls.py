from django.urls import path

from .views import DeviceAlertListView, MarkAlertSeenView, ReportAlertView

urlpatterns = [
    path("report/", ReportAlertView.as_view(), name="alerts-report"),
    path("<uuid:alert_id>/mark-seen/", MarkAlertSeenView.as_view(), name="alerts-mark-seen"),
    path("<uuid:device_id>/", DeviceAlertListView.as_view(), name="alerts-device-list"),
]
