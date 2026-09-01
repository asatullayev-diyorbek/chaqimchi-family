from django.urls import path

from .digest_view import RunDailyDigestView
from .views import ActivityHistoryView, IngestView, SitesView, SummaryView, TimelineView

urlpatterns = [
    path("ingest/", IngestView.as_view(), name="ingest"),
    path("digest/run/", RunDailyDigestView.as_view(), name="digest-run"),
    path("summary/<uuid:device_id>/", SummaryView.as_view(), name="summary"),
    path("history/<uuid:device_id>/", ActivityHistoryView.as_view(), name="history"),
    path("timeline/<uuid:device_id>/", TimelineView.as_view(), name="timeline"),
    path("sites/<uuid:device_id>/", SitesView.as_view(), name="sites"),
]
