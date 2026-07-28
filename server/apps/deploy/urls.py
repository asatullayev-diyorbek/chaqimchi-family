from django.urls import path

from .views import LatestVersionView

urlpatterns = [
    path("latest/", LatestVersionView.as_view(), name="deploy-latest"),
]
