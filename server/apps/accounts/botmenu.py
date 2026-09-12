"""The bot's main menu for an onboarded parent — a persistent reply
keyboard (buttons under the input box). Tapping a button sends its label as
a plain message, which telegram._handle_message routes back here."""

from . import tg_api
from .bot import _alerts, _children, _devices, _today
from .onboarding import img, miniapp_url

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
    "📖 qo'llanma": "guide",
    "📖 qo‘llanma": "guide",
}


def menu_keyboard() -> dict:
    return {
        "keyboard": [
            [{"text": "💻 Qurilmalar"}, {"text": "👦 Farzandlar"}],
            [{"text": "📊 Bugungi statistika"}, {"text": "🔔 Ogohlantirishlar"}],
            [{"text": "🔎 AI tahlil"}, {"text": "💳 Obuna"}],
            [{"text": "📖 Qo'llanma"}],
            [{"text": "📱 Ota-ona paneli", "web_app": {"url": miniapp_url()}}],
        ],
        "resize_keyboard": True,
        "is_persistent": True,
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


def _send_ai_insight(chat_id, parent):
    from apps.devices.models import Child
    from apps.insights import groq
    from apps.insights.format import format_insight_message
    from apps.insights.service import get_or_generate_weekly_insight

    sub = parent.family.subscription
    if not sub.allows("ai_analysis"):
        tg_api.send_message(chat_id, AI_UPSELL_TEXT)
        return
    if not groq.is_configured():
        tg_api.send_message(chat_id, "🔎 AI tahlil hozircha ulanmagan.")
        return

    children = list(Child.objects.filter(family=parent.family))
    if not children:
        tg_api.send_message(chat_id, "Hali farzand qo'shilmagan.")
        return

    sent_any = False
    for child in children:
        insight = get_or_generate_weekly_insight(child)
        if insight is None:
            continue
        tg_api.send_message(chat_id, format_insight_message(child.name, insight))
        sent_any = True
    if not sent_any:
        tg_api.send_message(chat_id, "Hozircha tahlil uchun yetarli ma'lumot yo'q.")


def _send_subscription(chat_id, parent):
    from apps.billing import click, payme
    from apps.billing.models import Invoice
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
    if sub.expires_at:
        lines.append(f"Amal qiladi: {sub.expires_at:%Y-%m-%d}gacha")

    buttons = []
    for plan in (Subscription.PLAN_MINI, Subscription.PLAN_MAX):
        if sub.plan == plan and sub.is_paid_and_active():
            continue
        price = Subscription.PLAN_PRICE_UZS[plan]
        label = dict(Subscription.PLAN_CHOICES)[plan]
        for provider, mod, configured in (
            (Invoice.PROVIDER_PAYME, payme, payme.is_configured()),
            (Invoice.PROVIDER_CLICK, click, click.is_configured()),
        ):
            if not configured:
                continue
            invoice = Invoice.objects.create(family=family, plan=plan, amount_uzs=price, provider=provider)
            url = mod.checkout_url(invoice)
            buttons.append([{
                "text": f"{label} — {price:,} so'm ({provider.title()})".replace(",", " "),
                "url": url,
            }])

    if not buttons:
        lines.append("\nTo'lov usullari hozircha ulanmagan.")

    tg_api.send_message(chat_id, "\n".join(lines), reply_markup={"inline_keyboard": buttons} if buttons else None)
