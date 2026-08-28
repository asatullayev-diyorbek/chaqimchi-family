from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve as serve_media

from apps.devices.views import ChildDetailView, ChildListCreateView, DeviceDetailView, DeviceListView


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/enroll/", include("apps.devices.urls")),
    path("api/children/", ChildListCreateView.as_view(), name="children"),
    path("api/children/<uuid:id>/", ChildDetailView.as_view(), name="child-detail"),
    path("api/tracking/", include("apps.tracking.urls")),
    path("api/devices/", DeviceListView.as_view(), name="device-list"),
    path("api/devices/<uuid:id>/", DeviceDetailView.as_view(), name="device-detail"),
    path("api/rules/", include("apps.rules.urls")),
    path("api/alerts/", include("apps.alerts.urls")),
    path("api/deploy/", include("apps.deploy.urls")),
    path("releases/", include("apps.deploy.release_urls")),
    path("api/health/", health, name="health"),
]

# Child photos are user uploads under MEDIA_ROOT. django.views.static.serve
# is not a high-performance file server, but on the PythonAnywhere free tier
# there is no separate media host and the volume here is tiny (a handful of
# <=5 MB images, validated on upload), so serving them from Django — in
# production too, not only when DEBUG — is the pragmatic choice. If a real
# static host or CDN is added later, drop this and map /media/ there.
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve_media, {"document_root": settings.MEDIA_ROOT}),
]
