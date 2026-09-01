"""Read-only Telegram bot commands for a linked parent.

Answered synchronously inside the webhook request (one small DB read + one
sendMessage). No auth beyond the sender's telegram_id matching a ParentUser.
"""

from django.utils import timezone

from apps.alerts.models import ALERT_LABELS, Alert
from apps.devices.models import ChildDevice
from apps.rules.models import Rule
from apps.tracking.digest import device_state, human_minutes, screen_minutes

from .models import ParentUser

HELP = (
    "ChaqimchiAI Guard\n\n"
    "/bugun — bugungi ekran vaqti va qolgan limit\n"
    "/ogohlantirishlar — oxirgi ogohlantirishlar\n"
    "/qurilmalar — qurilmalar holati"
)


def handle_command(text, telegram_id):
    """Returns the reply text for a bare /command, or None if it isn't one
    we handle (so the webhook can fall through to its /start <token> logic)."""
    cmd = text.strip().split()[0].lower().lstrip("/")
    if cmd not in {"start", "help", "bugun", "ogohlantirishlar", "qurilmalar"}:
        return None
    if cmd in {"start", "help"} and text.strip() != f"/{cmd}":
        return None  # "/start <token>" is the login/link flow, not a command

    parent = ParentUser.objects.filter(telegram_id=telegram_id).first()
    if parent is None:
        return "Bu Telegram hisob ChaqimchiAI Guard'ga ulanmagan. Ilova → Bildirishnomalar → Telegram'ni ulash."

    if cmd in {"start", "help"}:
        return HELP
    if cmd == "bugun":
        return _today(parent)
    if cmd == "ogohlantirishlar":
        return _alerts(parent)
    if cmd == "qurilmalar":
        return _devices(parent)
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
        return "Hali bog'langan qurilma yo'q."
    lines = ["💻 Qurilmalar"]
    for d in devices:
        who = (d.child.name if d.child else "") or d.child_name or "Qurilma"
        online, battery = device_state(d)
        bits = ["🟢 onlayn" if online else "⚪ oflayn"]
        if battery is not None:
            bits.append(f"🔋 {battery}%")
        lines.append(f"• {who} — {', '.join(bits)}")
    return "\n".join(lines)
