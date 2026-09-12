from django.urls import path

from .views import ChildInsightView, WeeklyRunView

urlpatterns = [
    path("weekly-run/", WeeklyRunView.as_view(), name="insights-weekly-run"),
    path("<uuid:child_id>/", ChildInsightView.as_view(), name="insights-child"),
]
