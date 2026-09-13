from django.urls import path

from .views import (
    ChildInsightDataView,
    ChildInsightSubmitView,
    ChildInsightView,
    CronSubmitView,
    PendingBatchView,
)

urlpatterns = [
    path("pending-batch/", PendingBatchView.as_view(), name="insights-pending-batch"),
    path("cron-submit/", CronSubmitView.as_view(), name="insights-cron-submit"),
    path("<uuid:child_id>/data/", ChildInsightDataView.as_view(), name="insights-child-data"),
    path("<uuid:child_id>/submit/", ChildInsightSubmitView.as_view(), name="insights-child-submit"),
    path("<uuid:child_id>/", ChildInsightView.as_view(), name="insights-child"),
]
