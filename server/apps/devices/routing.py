from django.urls import re_path

from .consumers import EnrollConsumer

websocket_urlpatterns = [
    re_path(r"^ws/enroll/(?P<device_id>[0-9a-f-]+)/$", EnrollConsumer.as_asgi()),
]
