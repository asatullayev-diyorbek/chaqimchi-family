"""Shared icon-blob validation/storage, used by both the tracking app's
app_icon events (apps/tracking/views.py) and the installed-apps sync
endpoint below — the same PNG shows up from either source, so both share
one content-addressed IconBlob table instead of each keeping its own copy.
"""

import base64
import binascii

from .models import IconBlob

# Guard against a malformed or hostile agent: a 32x32 PNG is ~1-3 KB, so a
# base64 payload over this is never a legitimate app icon.
MAX_ICON_B64_LEN = 96 * 1024


def get_or_create_icon_blob(sha256: str, data_b64: str) -> IconBlob | None:
    """Validates and stores one icon PNG, returning the (possibly
    already-existing) IconBlob, or None if the input is malformed/unsafe."""
    sha256 = (sha256 or "").strip().lower()
    if len(sha256) != 64 or not all(c in "0123456789abcdef" for c in sha256):
        return None
    if not isinstance(data_b64, str) or not (0 < len(data_b64) <= MAX_ICON_B64_LEN):
        return None
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except (ValueError, binascii.Error):
        return None
    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return None

    blob, _ = IconBlob.objects.get_or_create(sha256=sha256, defaults={"data_b64": data_b64})
    return blob
