"""Fire-and-forget operator DMs: a new parent finished onboarding, a device
got linked. Best-effort — a failed send never affects the request."""

from django.conf import settings

from . import tg_api


def _admin_ids():
    raw = getattr(settings, "ADMIN_TELEGRAM_IDS", "") or ""
    return [int(p) for p in (x.strip() for x in raw.split(",")) if p.isdigit()]


def notify_admins(text: str):
    for chat_id in _admin_ids():
        tg_api.send_message(chat_id, text)


def notify_new_parent(parent, source: str):
    from .models import ParentUser

    if parent.telegram_username:
        who = f"@{parent.telegram_username}"
    elif parent.email:
        who = parent.email
    else:
        who = f"id{parent.id}"
    name = (parent.full_name or "").strip()
    total = ParentUser.objects.filter(onboarding_required=False).count()
    lines = ["🆕 Yangi foydalanuvchi", f"{who}" + (f" ({name})" if name else ""), f"Manba: {source}"]
    if parent.phone:
        lines.append(f"Tel: {parent.phone}")
    lines.append(f"Jami faol: {total}")
    notify_admins("\n".join(lines))


def notify_new_device(device):
    who = ""
    if device.child_id:
        who = getattr(device.child, "name", "") or device.child_name
    who = who or device.child_name or "Farzand"
    plat = {"windows": "Windows", "android": "Android", "ios": "iOS"}.get(device.platform, device.platform)
    notify_admins(
        "📲 Yangi qurilma ulandi\n"
        f"Farzand: {who}\n"
        f"Platforma: {plat}\n"
        f"Oila: {device.family_id}"
    )
