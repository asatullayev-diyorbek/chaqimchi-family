from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AppInfo
from .serializers import AppInfoSerializer

MAX_DESCRIPTION_LEN = 1500
MAX_ITEM_LEN = 300
MAX_LIST_LEN = 8
MAX_NAME_LEN = 255
MAX_BULK_KEYS = 200


def _normalize_key(raw: str) -> str:
    return (raw or "").strip().lower()[:MAX_NAME_LEN]


class AppInfoBulkView(APIView):
    """GET /api/app-info/bulk/?keys=chrome.exe,roblox.exe,... — the cached
    category + display name for every key that has one, so a list screen
    (InstalledAppsScreen) can show a real AI-derived category per row
    without one request per app. Missing keys are simply absent from the
    response; the client falls back to its own client-side heuristic
    (lib/appDisplay.ts) for those, same as before this endpoint existed."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        raw_keys = (request.query_params.get("keys") or "").split(",")
        keys = {_normalize_key(k) for k in raw_keys if k.strip()}
        keys = set(list(keys)[:MAX_BULK_KEYS])
        infos = AppInfo.objects.filter(key__in=keys).values("key", "display_name", "category")
        return Response({i["key"]: {"display_name": i["display_name"], "category": i["category"]} for i in infos})


class AppInfoView(APIView):
    """GET /api/app-info/<key>/ — the cached explanation for this app
    (shared across every family, not per-child), or 404 if nobody has
    generated one yet."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, key):
        info = AppInfo.objects.filter(key=_normalize_key(key)).first()
        if info is None:
            return Response({"detail": "Hozircha ma'lumot yo'q"}, status=status.HTTP_404_NOT_FOUND)
        return Response(AppInfoSerializer(info).data)


class AppInfoSubmitView(APIView):
    """POST /api/app-info/<key>/submit/ — a parent's client stores its own
    Vercel-generated explanation. Any authenticated parent may write this —
    it's shared, non-personal content, same trust level as the app's own
    name/icon that's already visible to every family that has that app."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, key):
        key = _normalize_key(key)
        if not key:
            return Response({"detail": "Noto'g'ri ilova"}, status=status.HTTP_400_BAD_REQUEST)

        result = request.data
        display_name = str(result.get("display_name") or key).strip()[:MAX_NAME_LEN]
        description = str(result.get("description") or "").strip()[:MAX_DESCRIPTION_LEN]
        if not description:
            return Response({"detail": "Noto'g'ri format"}, status=status.HTTP_400_BAD_REQUEST)
        category = str(result.get("category") or "").strip()[:100]
        age_note = str(result.get("age_note") or "").strip()[:255]
        benefits = [str(b)[:MAX_ITEM_LEN] for b in (result.get("benefits") or [])][:MAX_LIST_LEN]
        risks = [str(r)[:MAX_ITEM_LEN] for r in (result.get("risks") or [])][:MAX_LIST_LEN]

        info, _ = AppInfo.objects.update_or_create(
            key=key,
            defaults={
                "display_name": display_name,
                "category": category,
                "description": description,
                "benefits": benefits,
                "risks": risks,
                "age_note": age_note,
            },
        )
        return Response(AppInfoSerializer(info).data)
