from django.urls import path

from .views import download_release, releases_page

urlpatterns = [
    path("", releases_page, name="releases-page"),
    path("download/<str:kind>/", download_release, name="release-download"),
]
