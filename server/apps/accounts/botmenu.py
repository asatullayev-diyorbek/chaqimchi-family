"""The bot's main menu for an onboarded parent — a persistent reply
keyboard (buttons under the input box). Tapping a button sends its label as
a plain message, which telegram._handle_message routes back here."""

from . import tg_api
from .bot import _alerts, _children, _devices, _today
from .onboarding import img, miniapp_url

AI_TEXT = (
    "🔎 AI tahlil — tez kunda\n\n"
    "Farzandingiz faoliyatini sun'iy intellekt tahlil qilib, ekran vaqti va "
    "odatlari bo'yicha tushunarli tavsiyalar beradi. Ustida ishlayapmiz."
)

# Button label (lower-cased) -> section key.
LABELS = {
    "💻 qurilmalar": "devices",
    "👦 farzandlar": "children",
    "📊 bugungi statistika": "today",
    "🔔 ogohlantirishlar": "alerts",
    "🔎 ai tahlil": "ai",
    "📖 qo'llanma": "guide",
    "📖 qo‘llanma": "guide",
}


def menu_keyboard() -> dict:
    return {
        "keyboard": [
            [{"text": "💻 Qurilmalar"}, {"text": "👦 Farzandlar"}],
            [{"text": "📊 Bugungi statistika"}, {"text": "🔔 Ogohlantirishlar"}],
            [{"text": "🔎 AI tahlil"}, {"text": "📖 Qo'llanma"}],
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
        tg_api.send_message(chat_id, _devices(parent))
    elif section == "children":
        tg_api.send_message(chat_id, _children(parent))
    elif section == "today":
        tg_api.send_message(chat_id, _today(parent))
    elif section == "alerts":
        tg_api.send_message(chat_id, _alerts(parent))
    elif section == "ai":
        tg_api.send_photo(chat_id, img("ai-analysis-teaser"), caption=AI_TEXT)
    elif section == "guide":
        from .onboarding import send_install_guide

        send_install_guide(chat_id)
