from django.urls import path

from .views import AppInfoBulkView, AppInfoSubmitView, AppInfoView

urlpatterns = [
    path("bulk/", AppInfoBulkView.as_view(), name="appinfo-bulk"),
    path("<str:key>/submit/", AppInfoSubmitView.as_view(), name="appinfo-submit"),
    path("<str:key>/", AppInfoView.as_view(), name="appinfo"),
]
