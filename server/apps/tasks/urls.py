from django.urls import path

from .views import ChannelCheckView, TaskListView

urlpatterns = [
    path("", TaskListView.as_view(), name="tasks-list"),
    path("channel/check/", ChannelCheckView.as_view(), name="tasks-channel-check"),
]
