"""Read-only Telegram bot commands for an onboarded parent.

Answered synchronously inside the webhook request (one small DB read + one
sendMessage). The caller (telegram._handle_message) has already resolved the
sender to a ParentUser and checked they finished onboarding.
"""

from django.utils import timezone

from apps.alerts.models import ALERT_LABELS, Alert
from apps.devices.models import ChildDevice
from apps.rules.models import Rule
from apps.tracking.digest import device_state, human_minutes, screen_minutes

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


def _daily_limit(device):
    rule = Rule.objects.filter(device=device, rule_type="daily_limit_minutes").first()
    if rule and isinstance(rule.value, dict):
        m = rule.value.get("minutes")
        if isinstance(m, (int, float)):
            return int(m)
    return None


def _today(parent):
    devices = list(_family_devices(parent))
    if not devices:
        return "Hali bog'langan qurilma yo'q."
    lines = ["📊 Bugun"]
    for d in devices:
        who = (d.child.name if d.child else "") or d.child_name or "Qurilma"
        used = screen_minutes(d)
        limit = _daily_limit(d)
        if limit:
            left = max(0, limit - used)
            lines.append(f"• {who}: {human_minutes(used)} / {human_minutes(limit)} ({human_minutes(left)} qoldi)")
        else:
            lines.append(f"• {who}: {human_minutes(used)} (limit yo'q)")
    return "\n".join(lines)


def _alerts(parent):
    rows = (
        Alert.objects.filter(device__family_id=parent.family_id)
        .select_related("device", "device__child")
        .order_by("-triggered_at")[:5]
    )
    if not rows:
        return "🔔 Ogohlantirish yo'q."
    lines = ["🔔 Oxirgi ogohlantirishlar"]
    for a in rows:
        who = (a.device.child.name if a.device.child else "") or a.device.child_name or "Qurilma"
        label = ALERT_LABELS.get(a.alert_type, a.alert_type)
        mark = "" if a.seen else " • yangi"
        lines.append(f"• {timezone.localtime(a.triggered_at):%d.%m %H:%M} {who}: {label}{mark}")
    return "\n".join(lines)


def _devices(parent):
    devices = list(_family_devices(parent))
    if not devices:
        return "Hali bog'langan qurilma yo'q.\n\nO'rnatish uchun: /yuklab_olish"
    lines = ["💻 Qurilmalar"]
    for d in devices:
        who = (d.child.name if d.child else "") or d.child_name or "Qurilma"
        online, battery = device_state(d)
        bits = ["🟢 onlayn" if online else "⚪ oflayn"]
        if battery is not None:
            bits.append(f"🔋 {battery}%")
        lines.append(f"• {who} — {', '.join(bits)}")
    return "\n".join(lines)


def _children(parent):
    from datetime import date

    from apps.devices.models import Child

    children = list(
        Child.objects.filter(family_id=parent.family_id).prefetch_related("devices")
    )
    if not children:
        return "Hali farzand qo'shilmagan.\n\nFarzand qurilmasini ulaganingizda avtomatik qo'shiladi: /yuklab_olish"
    lines = ["👦 Farzandlar"]
    for c in children:
        device_count = sum(
            1 for d in c.devices.all() if d.status == ChildDevice.STATUS_LINKED
        )
        used = sum(
            screen_minutes(d)
            for d in c.devices.all()
            if d.status == ChildDevice.STATUS_LINKED
        )
        age = ""
        if c.birth_date:
            years = (date.today() - c.birth_date).days // 365
            age = f", {years} yosh"
        lines.append(
            f"• {c.name}{age} — {device_count} qurilma, bugun {human_minutes(used)}"
        )
    return "\n".join(lines)
