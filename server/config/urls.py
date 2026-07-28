from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

from apps.devices.views import DeviceListView


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/enroll/", include("apps.devices.urls")),
    path("api/tracking/", include("apps.tracking.urls")),
    path("api/devices/", DeviceListView.as_view(), name="device-list"),
    path("api/rules/", include("apps.rules.urls")),
    path("api/alerts/", include("apps.alerts.urls")),
    path("api/deploy/", include("apps.deploy.urls")),
    path("api/health/", health, name="health"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
