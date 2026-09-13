"""The bot's main menu for an onboarded parent — a persistent reply
keyboard (buttons under the input box). Tapping a button sends its label as
a plain message, which telegram._handle_message routes back here."""

from . import tg_api
from .bot import _alerts, _children, _devices, _today
from .onboarding import img, miniapp_url

SUBDUR_PREFIX = "subdur:"
TASK_PREFIX = "task:"

AI_UPSELL_TEXT = (
    "🔎 AI tahlil\n\n"
    "Farzandingiz faoliyatini sun'iy intellekt tahlil qilib, ekran vaqti va "
    "odatlari bo'yicha tushunarli tavsiyalar beradi.\n\n"
    "Bu — Max tarifiga xos imkoniyat. «💳 Obuna» bo'limidan Max'ga o'ting."
)

# Button label (lower-cased) -> section key.
LABELS = {
    "💻 qurilmalar": "devices",
    "👦 farzandlar": "children",
    "📊 bugungi statistika": "today",
    "🔔 ogohlantirishlar": "alerts",
    "🔎 ai tahlil": "ai",
    "💳 obuna": "subscription",
    "🎯 vazifalar": "tasks",
    "📖 qo'llanma": "guide",
    "📖 qo‘llanma": "guide",
}


def menu_keyboard() -> dict:
    return {
        "keyboard": [
            [{"text": "💻 Qurilmalar"}, {"text": "👦 Farzandlar"}],
            [{"text": "📊 Bugungi statistika"}, {"text": "🔔 Ogohlantirishlar"}],
            [{"text": "🔎 AI tahlil"}, {"text": "💳 Obuna"}],
            [{"text": "🎯 Vazifalar"}, {"text": "📖 Qo'llanma"}],
            [{"text": "📱 Ota-ona paneli", "web_app": {"url": miniapp_url()}}],
        ],
        "resize_keyboard": True,
    }


def _root_text(parent) -> str:
    plan = "Beta (bepul)"
    sub = getattr(parent.family, "subscription", None)
    if sub is not None:
        plan = sub.plan_label
    return (
        "Spino24 — ota-ona paneli\n\n"
        f"Tarif: {plan}\n\n"
        "Pastdagi tugmalar orqali boshqaring. To'liq ko'rinish uchun "
        "«📱 Ota-ona paneli» tugmasini bosing."
    )


def send_menu(chat_id, parent, with_banner: bool = False):
    if with_banner:
        tg_api.send_photo(chat_id, img("menu-banner"))
    tg_api.send_message(chat_id, _root_text(parent), reply_markup=menu_keyboard())


def matches(text: str) -> str | None:
    """Section key for a menu button label, or None."""
    return LABELS.get((text or "").strip().lower())


def handle_menu_button(section: str, chat_id, parent):
    if section == "devices":
        tg_api.send_message(chat_id, _devices(parent), parse_mode="HTML")
    elif section == "children":
        tg_api.send_message(chat_id, _children(parent))
    elif section == "today":
        tg_api.send_message(chat_id, _today(parent))
    elif section == "alerts":
        tg_api.send_message(chat_id, _alerts(parent), parse_mode="HTML")
    elif section == "ai":
        _send_ai_insight(chat_id, parent)
    elif section == "guide":
        from .onboarding import send_install_guide

        send_install_guide(chat_id)
    elif section == "subscription":
        _send_subscription(chat_id, parent)
    elif section == "tasks":
        _send_tasks(chat_id, parent)


def _send_ai_insight(chat_id, parent):
    """Django/the bot can't call Groq itself (see apps/insights/service.py),
    so this only shows whatever the Vercel-driven weekly push already
    generated and cached — no on-demand generation from here. On-demand
    generation lives in the parent-mobile app, which talks to the Vercel
    relay directly."""
    from apps.devices.models import Child
    from apps.insights.format import format_insight_message
    from apps.insights.service import get_cached_insight

    sub = parent.family.subscription
    if not sub.allows("ai_analysis"):
        tg_api.send_message(chat_id, AI_UPSELL_TEXT)
        return

    children = list(Child.objects.filter(family=parent.family))
    if not children:
        tg_api.send_message(chat_id, "Hali farzand qo'shilmagan.")
        return

    sent_any = False
    for child in children:
        insight = get_cached_insight(child)
        if insight is None:
            continue
        tg_api.send_message(chat_id, format_insight_message(child.name, insight))
        sent_any = True
    if not sent_any:
        tg_api.send_message(
            chat_id,
            "🔎 AI tahlil hali tayyor emas. Har hafta avtomatik tayyorlanadi — "
            "yoki «📱 Ota-ona paneli»dan hozir so'rov yuboring.",
        )


DURATION_LABELS = {1: "1 oy", 3: "3 oy", 12: "1 yil"}


def _send_subscription(chat_id, parent):
    from apps.billing import click, payme
    from apps.devices.models import Child, ChildDevice
    from .models import Subscription

    family = parent.family
    sub = family.subscription
    children = Child.objects.filter(family=family).count()
    devices = ChildDevice.objects.filter(family=family, status=ChildDevice.STATUS_LINKED).count()

    def fmt_limit(n):
        return "cheksiz" if n is None else str(n)

    lines = [
        "💳 Obuna",
        "",
        f"Joriy tarif: {sub.plan_label}",
        f"Farzand: {children}/{fmt_limit(sub.limit('max_children'))}",
        f"Qurilma: {devices}/{fmt_limit(sub.limit('max_devices'))}",
    ]
    if sub.plan == Subscription.PLAN_BETA:
        if sub.is_trial_active:
            lines.append(f"Bepul sinov: {sub.trial_ends_at:%Y-%m-%d}gacha")
        else:
            lines.append("Bepul sinov muddati tugadi — davom etish uchun tarif tanlang.")
    elif sub.expires_at:
        lines.append(f"Amal qiladi: {sub.expires_at:%Y-%m-%d}gacha")

    if not (payme.is_configured() or click.is_configured()):
        lines.append("\nTo'lov usullari hozircha ulanmagan.")
        tg_api.send_message(chat_id, "\n".join(lines))
        return

    buttons = []
    for plan in (Subscription.PLAN_MINI, Subscription.PLAN_MAX):
        if sub.plan == plan and sub.is_paid_and_active():
            continue
        label = dict(Subscription.PLAN_CHOICES)[plan]
        one_month = Subscription.duration_price_uzs(plan, 1)
        for months in (1, 3, 12):
            price = Subscription.duration_price_uzs(plan, months)
            if price is None:
                continue
            text = f"{label} · {DURATION_LABELS[months]} — {price:,} so'm".replace(",", " ")
            if one_month and price < one_month * months:
                pct = round((1 - price / (one_month * months)) * 100)
                text += f" (-{pct}%)"
            buttons.append([{"text": text, "callback_data": f"{SUBDUR_PREFIX}{plan}:{months}"}])

    lines.append("\nTarif va muddatni tanlang:")
    tg_api.send_message(chat_id, "\n".join(lines), reply_markup={"inline_keyboard": buttons} if buttons else None)


def send_duration_checkout(chat_id, message_id, callback_id, parent, plan: str, months: int):
    """Second step of the Obuna flow — a plan+duration button was tapped;
    show provider (Payme/Click) buttons with a real checkout URL for that
    exact plan/duration, mirroring the marketing site's duration toggle."""
    from apps.billing import click, payme
    from apps.billing.models import Invoice
    from .models import Subscription

    price = Subscription.duration_price_uzs(plan, months)
    if price is None:
        tg_api.answer_callback(callback_id, "Noto'g'ri tanlov")
        return

    label = dict(Subscription.PLAN_CHOICES)[plan]
    duration_label = DURATION_LABELS.get(months, f"{months} oy")
    family = parent.family

    buttons = []
    for provider, mod, configured in (
        (Invoice.PROVIDER_PAYME, payme, payme.is_configured()),
        (Invoice.PROVIDER_CLICK, click, click.is_configured()),
    ):
        if not configured:
            continue
        invoice = Invoice.objects.create(
            family=family, plan=plan, amount_uzs=price, period_days=months * 30, provider=provider
        )
        url = mod.checkout_url(invoice)
        buttons.append([{"text": f"{provider.title()} orqali to'lash", "url": url}])

    tg_api.answer_callback(callback_id)
    text = f"{label} — {duration_label} — {price:,} so'm".replace(",", " ")
    tg_api.edit_message_text(chat_id, message_id, text, reply_markup={"inline_keyboard": buttons} if buttons else None)


def _referral_link(parent) -> str:
    from django.conf import settings

    return f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start=ref_{parent.id}"


def _send_tasks(chat_id, parent):
    from apps.tasks import service
    from apps.tasks.models import Task, TaskCompletion

    tasks = list(Task.objects.filter(is_active=True))
    completions = {c.task_id: c for c in TaskCompletion.objects.filter(parent=parent)}
    wallet = service.get_wallet(parent.family)

    status_icon = {
        None: "⬜",
        TaskCompletion.STATUS_PENDING: "⏳",
        TaskCompletion.STATUS_APPROVED: "✅",
        TaskCompletion.STATUS_REJECTED: "❌",
    }

    lines = [
        "🎯 Vazifalar",
        "",
        f"💰 Balansingiz: {wallet.balance_uzs:,} coin".replace(",", " "),
        "(Obuna to'lovida chegirma sifatida ishlatiladi)",
        f"🔢 Sizning ID raqamingiz: {parent.short_id}",
        "",
    ]
    buttons = []

    for task in tasks:
        completion = completions.get(task.id)
        icon = status_icon[completion.status if completion else None]
        reward = f"+{task.reward_uzs:,} coin".replace(",", " ")
        lines.append(f"{icon} {task.title} — {reward}")
        if task.description:
            lines.append(f"   {task.description}")

        approved = completion is not None and completion.status == TaskCompletion.STATUS_APPROVED

        if task.type == Task.TYPE_CHANNEL_JOIN and not approved:
            buttons.append([{"text": "✅ A'zo bo'ldim — tekshirish", "callback_data": f"{TASK_PREFIX}check_channel"}])
        elif task.type in Task.STORY_TYPES and not approved:
            lines.append(f"   Postni ulashing: {task.target_url}")
            lines.append(f"   Story ustiga ID raqamingizni yozing: {parent.short_id}")
            lines.append("   (Hech narsa yuborish shart emas — adminlarimiz o'zi tekshiradi.)")
        elif task.type == Task.TYPE_REFERRAL:
            lines.append(f"   Havolangiz: {_referral_link(parent)}")

    tg_api.send_message(chat_id, "\n".join(lines), reply_markup={"inline_keyboard": buttons} if buttons else None)


def handle_task_action(action: str, chat_id, callback_id, parent):
    from apps.tasks import service
    from apps.tasks.models import Task, TaskCompletion

    if action == "check_channel":
        if not service.is_channel_member(parent):
            tg_api.answer_callback(callback_id, "❌ Hali kanalga a'zo emassiz.")
            return
        task = service.get_task(Task.TYPE_CHANNEL_JOIN)
        already = TaskCompletion.objects.filter(
            task=task, parent=parent, status=TaskCompletion.STATUS_APPROVED
        ).exists()
        service.complete_channel_join(parent)
        tg_api.answer_callback(callback_id, "Balansda allaqachon bor." if already else "✅ Tasdiqlandi!")
        if not already:
            _send_tasks(chat_id, parent)
        return

    tg_api.answer_callback(callback_id)
