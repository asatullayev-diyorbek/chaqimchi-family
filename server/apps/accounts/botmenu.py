"""The bot's inline mini-menu for an onboarded parent. One message, edited
in place as the parent taps between sections."""

from . import tg_api
from .bot import _alerts, _children, _devices, _today
from .models import ParentUser
from .onboarding import miniapp_url

AI_TEXT = (
    "🔎 AI tahlil — tez kunda\n\n"
    "Farzandingiz faoliyatini sun'iy intellekt tahlil qilib, ekran vaqti va "
    "odatlari bo'yicha tushunarli tavsiyalar beradi. Ustida ishlayapmiz."
)


def _root_markup() -> dict:
    return {
        "inline_keyboard": [
            [
                {"text": "💻 Qurilmalar", "callback_data": "menu:devices"},
                {"text": "👦 Farzandlar", "callback_data": "menu:children"},
            ],
            [{"text": "📊 Bugungi statistika", "callback_data": "menu:today"}],
            [{"text": "🔎 AI tahlil", "callback_data": "menu:ai"}],
            [{"text": "📱 Ota-ona panelini ochish", "web_app": {"url": miniapp_url()}}],
        ]
    }


def _back_markup() -> dict:
    return {"inline_keyboard": [[{"text": "⬅️ Menyu", "callback_data": "menu:root"}]]}


def _root_text(parent) -> str:
    plan = "Beta (bepul)"
    sub = getattr(parent.family, "subscription", None)
    if sub is not None:
        plan = sub.plan_label
    return f"Spino24 — ota-ona paneli\n\nTarif: {plan}\n\nBo'limni tanlang:"


def _section(section: str, parent):
    """(text, markup) for one menu section."""
    if section == "devices":
        return _devices(parent), _back_markup()
    if section == "children":
        return _children(parent), _back_markup()
    if section == "today":
        return _today(parent), _back_markup()
    if section == "ai":
        return AI_TEXT, _back_markup()
    return _root_text(parent), _root_markup()


def send_menu(chat_id, parent):
    tg_api.send_message(chat_id, _root_text(parent), reply_markup=_root_markup())


def handle_menu_callback(callback_query: dict):
    data = callback_query.get("data", "")
    callback_id = callback_query.get("id")
    message = callback_query.get("message") or {}
    chat_id = (message.get("chat") or {}).get("id")
    message_id = message.get("message_id")
    from_id = (callback_query.get("from") or {}).get("id")

    parent = ParentUser.objects.filter(telegram_id=from_id).first()
    if parent is None or parent.onboarding_required:
        tg_api.answer_callback(callback_id, "Avval /start bosing.")
        return

    section = data.split(":", 1)[1] if ":" in data else "root"
    text, markup = _section(section, parent)

    tg_api.answer_callback(callback_id)
    if chat_id and message_id:
        tg_api.edit_message_text(chat_id, message_id, text, reply_markup=markup)
