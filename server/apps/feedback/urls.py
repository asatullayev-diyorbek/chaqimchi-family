from django.urls import path

from .views import ReviewView

urlpatterns = [
    path("review/", ReviewView.as_view(), name="feedback-review"),
]
