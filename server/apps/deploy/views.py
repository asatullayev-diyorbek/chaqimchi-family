import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import render
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.devices.models import ChildDevice

from .models import AgentVersion
from .serializers import AgentVersionSerializer


RELEASE_PATTERN = re.compile(r"^chaqimchi-(agent|installer)-v(\d+)\.exe$")
TASHKENT_ZONE = ZoneInfo("Asia/Tashkent")


def _release_files():
    releases_dir = Path(settings.RELEASES_DIR)
    releases = {}
    if not releases_dir.is_dir():
        return releases
    for path in releases_dir.glob("chaqimchi-*-v*.exe"):
        match = RELEASE_PATTERN.match(path.name)
        if not match:
            continue
        kind, version = match.groups()
        stat = path.stat()
        candidate = {
            "path": path,
            "version": int(version),
            "size": stat.st_size,
            "updated_at": datetime.fromtimestamp(stat.st_mtime, TASHKENT_ZONE),
        }
        if kind not in releases or candidate["version"] > releases[kind]["version"]:
            releases[kind] = candidate
    return releases


def releases_page(request):
    """Public, intentionally small download page for the current Windows builds."""
    releases = _release_files()
    build_server_url = settings.CHAQIMCHI_PUBLIC_API_URL
    build_command = (
        ".\\scripts\\windows\\build-guard-setup.ps1 `\n"
        "  -Version 0.1.0-test `\n"
        f"  -ServerUrl {build_server_url}"
    )
    return render(
        request,
        "deploy/releases.html",
        {"installer": releases.get("installer"), "build_command": build_command},
    )


def download_release(request, kind):
    release = _release_files().get(kind)
    if release is None:
        raise Http404("Build topilmadi")
    return FileResponse(
        release["path"].open("rb"),
        as_attachment=True,
        filename=release["path"].name,
        content_type="application/vnd.microsoft.portable-executable",
    )


class LatestVersionView(APIView):
    """GET /api/deploy/latest/ — device-secret authenticated.

    No signature verification here — see agent/internal/updater's package
    doc for why that's a deliberate, temporary gap (internal dev-cycle
    speed per the architecture doc), not a security shortcut left in by
    accident. Bosqich 6 is where signed/verified OTA lands.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not isinstance(request.user, ChildDevice):
            return Response(
                {"detail": "Device autentifikatsiyasi talab qilinadi"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        latest = AgentVersion.objects.filter(is_active=True).order_by("-released_at").first()
        if latest is None:
            return Response(
                {"detail": "Hozircha e'lon qilingan versiya yo'q"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(AgentVersionSerializer(latest).data)
