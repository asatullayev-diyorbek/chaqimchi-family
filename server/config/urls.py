from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/enroll/", include("apps.devices.urls")),
    path("api/tracking/", include("apps.tracking.urls")),
    path("api/health/", health, name="health"),
]
