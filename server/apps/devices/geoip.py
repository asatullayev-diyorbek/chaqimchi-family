"""Best-effort IP-based approximate location for a device.

City-level accuracy at best — this is the always-available fallback when the
agent hasn't reported a more precise Windows-Location-API fix (see
ChildDevice.geo_source). Uses ip-api.com's free tier (no key, ~45 req/min
limit) since this is low volume: one lookup per device per hour at most,
never per request.
"""

import json
import logging
import urllib.request

from django.utils import timezone

from .models import ChildDevice

logger = logging.getLogger(__name__)

_TIMEOUT = 5
_REFRESH_INTERVAL = timezone.timedelta(hours=1)


def client_ip(request) -> str | None:
    """The request's public IP, respecting a reverse proxy (PythonAnywhere
    sits behind one — X-Forwarded-For carries the real client, REMOTE_ADDR
    would just be the proxy)."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _lookup(ip: str) -> dict | None:
    url = f"http://ip-api.com/json/{ip}?fields=status,lat,lon,city,regionName,country"
    try:
        with urllib.request.urlopen(url, timeout=_TIMEOUT) as response:
            data = json.loads(response.read())
    except Exception:
        return None
    if data.get("status") != "success":
        return None
    return data


def update_device_geo_from_ip(device: ChildDevice, request) -> None:
    """Best-effort: never raises, never blocks the ingest response on a slow
    or failed lookup beyond the request's own timeout."""
    ip = client_ip(request)
    if not ip or ip in ("127.0.0.1", "::1"):
        return

    # A recent, more precise GPS fix wins — don't overwrite it with a
    # coarser IP-based guess just because this is a fresh ingest request.
    has_fresh_gps = (
        device.geo_source == ChildDevice.GEO_SOURCE_GPS
        and device.geo_updated_at is not None
        and timezone.now() - device.geo_updated_at <= _REFRESH_INTERVAL
    )
    if has_fresh_gps:
        if ip != device.last_ip:
            ChildDevice.objects.filter(id=device.id).update(last_ip=ip)
        return

    stale = device.geo_updated_at is None or timezone.now() - device.geo_updated_at > _REFRESH_INTERVAL
    if ip == device.last_ip and not stale:
        return

    try:
        result = _lookup(ip)
        fields = {"last_ip": ip}
        if result:
            label_parts = [p for p in (result.get("city"), result.get("regionName"), result.get("country")) if p]
            fields.update(
                geo_lat=result.get("lat"),
                geo_lng=result.get("lon"),
                geo_location_label=", ".join(label_parts),
                geo_source=ChildDevice.GEO_SOURCE_IP,
                geo_updated_at=timezone.now(),
            )
        ChildDevice.objects.filter(id=device.id).update(**fields)
    except Exception:
        logger.exception("IP geolocation lookup failed for device=%s", device.id)
