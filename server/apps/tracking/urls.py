from django.urls import path

from .views import IngestView, SummaryView

urlpatterns = [
    path("ingest/", IngestView.as_view(), name="ingest"),
    path("summary/<uuid:device_id>/", SummaryView.as_view(), name="summary"),
]
