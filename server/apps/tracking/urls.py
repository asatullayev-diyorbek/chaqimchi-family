from django.urls import path

from .views import ActivityHistoryView, IngestView, SummaryView

urlpatterns = [
    path("ingest/", IngestView.as_view(), name="ingest"),
    path("summary/<uuid:device_id>/", SummaryView.as_view(), name="summary"),
    path("history/<uuid:device_id>/", ActivityHistoryView.as_view(), name="history"),
]
