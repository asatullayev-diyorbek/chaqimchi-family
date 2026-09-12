"""Read-only Telegram bot commands for an onboarded parent.

Answered synchronously inside the webhook request (one small DB read + one
sendMessage). The caller (telegram._handle_message) has already resolved the
sender to a ParentUser and checked they finished onboarding.
"""

from django.utils import timezone

from apps.alerts.models import ALERT_LABELS, Alert
from apps.devices.models import ChildDevice
from apps.rules.models import Rule
from apps.tracking.digest import (
    device_state,
    human_ago,
    human_minutes,
    today_usage_by_device,
)

from .emoji import ce, esc

_ALERT_ICON = {
    "limit_reached": ce("shock"),
    "blocked_app_opened": ce("angry"),
    "settings_panel_access": ce("lock"),
}


def _bar(used, limit, width=8):
    """Text progress bar: ▓▓▓░░░░░ (all empty when there's no limit)."""
    if not limit or limit <= 0:
        return "░" * width
    filled = min(width, round(width * used / limit))
    return "▓" * filled + "░" * (width - filled)


def _pretty_app(name):
    if not name:
        return ""
    if name.lower().endswith(".exe"):
        return name[:-4].replace("_", " ").title()
    return name


def _child_of(device):
    return (device.child.name if device.child_id else "") or device.child_name or "Qurilma"


def _short_date(dt):
    local = timezone.localtime(dt)
    today = timezone.localtime(timezone.now()).date()
    if local.date() == today:
        return f"Bugun {local:%H:%M}"
    if (today - local.date()).days == 1:
        return f"Kecha {local:%H:%M}"
    return f"{local:%d.%m %H:%M}"

HELP = (
    "Spino24\n\n"
    "/menyu — asosiy menyu\n"
    "/bugun — bugungi ekran vaqti va qolgan limit\n"
    "/qurilmalar — qurilmalar holati\n"
    "/farzandlar — farzandlar ro'yxati\n"
    "/ogohlantirishlar — oxirgi ogohlantirishlar\n"
    "/yuklab_olish — o'rnatish qo'llanmasi"
)


def handle_command(cmd, parent):
    """Reply text for a bare /command from an onboarded parent, or None if
    it isn't one we handle here."""
    if cmd in ("help", "yordam"):
        return HELP
    if cmd == "bugun":
        return _today(parent)
    if cmd == "ogohlantirishlar":
        return _alerts(parent)
    if cmd == "qurilmalar":
        return _devices(parent)
    if cmd == "farzandlar":
        return _children(parent)
    return None


def _family_devices(parent):
    return ChildDevice.objects.filter(
        family_id=parent.family_id, status=ChildDevice.STATUS_LINKED
    ).select_related("child")


def _daily_limits_by_device(device_ids):
    """{device_id: minutes} for the daily_limit_minutes rule, in one query."""
    out = {}
    for device_id, value in Rule.objects.filter(
        device_id__in=list(device_ids), rule_type="daily_limit_minutes"
    ).values_list("device_id", "value"):
        if isinstance(value, dict) and isinstance(value.get("minutes"), (int, float)):
            out[device_id] = int(value["minutes"])
    return out


_NO_DEVICES = (
    "Hali birorta qurilma ulanmagan.\n\n"
    "Farzandingiz kompyuteriga Spino24'ni o'rnatib ulash uchun «📖 Qo'llanma» "
    "bo'limini oching — 4 qadam."
)


def _today(parent):
    devices = list(_family_devices(parent))
    if not devices:
        return "📊 Bugungi ekran vaqti\n\n" + _NO_DEVICES

    ids = [d.id for d in devices]
    usage = today_usage_by_device(ids)
    limits = _daily_limits_by_device(ids)

    # Group devices by child so a child with a laptop + a phone shows once.
    by_child = {}
    for d in devices:
        key = d.child_id or f"dev:{d.id}"
        entry = by_child.setdefault(key, {"name": _child_of(d), "used": 0, "limit": 0, "top": ("", 0)})
        u = usage.get(d.id, {})
        entry["used"] += u.get("minutes", 0)
        lim = limits.get(d.id)
        if lim:
            entry["limit"] = max(entry["limit"], lim)
        if u.get("top_minutes", 0) > entry["top"][1]:
            entry["top"] = (u.get("top_app", ""), u.get("top_minutes", 0))

    lines = ["📊 Bugungi ekran vaqti", ""]
    family_total = 0
    for e in by_child.values():
        family_total += e["used"]
        used, limit = e["used"], e["limit"]
        lines.append(f"👤 {e['name']}")
        if limit:
            left = max(0, limit - used)
            status = "✅ limit ichida" if used < limit else "🔴 limit oshdi"
            lines.append(f"{_bar(used, limit)}  {human_minutes(used)} / {human_minutes(limit)}")
            lines.append(f"{status}  ·  {human_minutes(left)} qoldi")
        else:
            lines.append(f"{_bar(used, 0)}  {human_minutes(used)}  ·  limit o'rnatilmagan")
        if e["top"][0]:
            lines.append(f"Eng ko'p: {_pretty_app(e['top'][0])} ({human_minutes(e['top'][1])})")
        lines.append("")

    if len(by_child) > 1:
        lines.append(f"Oilada bugun jami: {human_minutes(family_total)}")
    return "\n".join(lines).strip()


def _alerts(parent):
    from datetime import datetime, time

    rows = list(
        Alert.objects.filter(device__family_id=parent.family_id)
        .select_related("device", "device__child")
        .order_by("-triggered_at")[:6]
    )
    if not rows:
        return "🔔 Ogohlantirishlar\n\nHozircha ogohlantirish yo'q — hammasi joyida. ✅"

    tz = timezone.get_current_timezone()
    day_start = timezone.make_aware(datetime.combine(timezone.localdate(), time.min), tz)
    today_count = sum(1 for a in rows if a.triggered_at >= day_start)
    unseen = sum(1 for a in rows if not a.seen)

    lines = ["🔔 Ogohlantirishlar", ""]
    summary = []
    if today_count:
        summary.append(f"Bugun: {today_count}")
    if unseen:
        summary.append(f"{ce('eyes')} ko'rilmagan: {unseen}")
    if summary:
        lines.append("  ·  ".join(summary))
        lines.append("")

    for a in rows:
        icon = _ALERT_ICON.get(a.alert_type, "🔔")
        who = esc(_child_of(a.device))
        label = esc(ALERT_LABELS.get(a.alert_type, a.alert_type))
        extra = ""
        app = (a.payload or {}).get("app_name") or (a.payload or {}).get("app")
        if a.alert_type == "blocked_app_opened" and app:
            extra = f": {esc(_pretty_app(app))}"
        lines.append(f"{icon} {_short_date(a.triggered_at)} — {who}")
        lines.append(f"{label}{extra}")
        lines.append("")

    lines.append("Barchasini «📱 Ota-ona paneli»da ko'ring.")
    return "\n".join(lines).strip()


def _devices(parent):
    devices = list(_family_devices(parent))
    if not devices:
        return f"{ce('laptop')} Qurilmalar\n\n" + _NO_DEVICES

    usage = today_usage_by_device([d.id for d in devices])
    lines = [f"{ce('laptop')} Qurilmalar ({len(devices)})", ""]
    for d in devices:
        online, battery = device_state(d)
        plat = {"windows": "Windows", "android": "Android", "ios": "iPad"}.get(d.platform, d.platform)
        lines.append(f"🖥 {esc(_child_of(d))} — {plat}")
        if online:
            row = "🟢 Onlayn"
            if battery is not None:
                row += f"  ·  🔋 {battery}%"
        else:
            row = f"⚪ Oflayn  ·  oxirgi aloqa: {human_ago(d.last_sync)}"
        lines.append(row)
        today = usage.get(d.id, {}).get("minutes", 0)
        bits = [f"bugun {human_minutes(today)}"]
        if d.agent_version:
            bits.append(f"Guard v{d.agent_version}")
        lines.append("  ·  ".join(bits))
        lines.append("")
    return "\n".join(lines).strip()


def _children(parent):
    from datetime import date

    from apps.devices.models import Child

    children = list(
        Child.objects.filter(family_id=parent.family_id).prefetch_related("devices")
    )
    if not children:
        return (
            "👦 Farzandlar\n\n"
            "Hali farzand qo'shilmagan. Qurilma ulaganingizda farzand avtomatik "
            "qo'shiladi — ismi va yoshini keyin panelda tahrirlaysiz."
        )

    linked = {
        c.id: [d for d in c.devices.all() if d.status == ChildDevice.STATUS_LINKED]
        for c in children
    }
    all_ids = [d.id for ds in linked.values() for d in ds]
    usage = today_usage_by_device(all_ids)
    limits = _daily_limits_by_device(all_ids)

    lines = [f"👦 Farzandlar ({len(children)})", ""]
    for c in children:
        devs = linked[c.id]
        used = sum(usage.get(d.id, {}).get("minutes", 0) for d in devs)
        limit = max((limits.get(d.id, 0) for d in devs), default=0)
        age = ""
        if c.birth_date:
            age = f" · {(date.today() - c.birth_date).days // 365} yosh"
        lines.append(f"👤 {c.name}{age}")
        lines.append(f"{len(devs)} qurilma  ·  bugun {human_minutes(used)}")
        if limit:
            lines.append("✅ Limit ichida" if used < limit else "🔴 Limit oshdi")
            lines.append(f"Kunlik limit: {human_minutes(limit)}")
        else:
            lines.append("Limit o'rnatilmagan")
        lines.append("")
    return "\n".join(lines).strip()
