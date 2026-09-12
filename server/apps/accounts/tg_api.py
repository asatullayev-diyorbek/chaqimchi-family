"""Low-level Telegram Bot API calls, shared by the webhook handler, the
onboarding flow and the bot menu.

All best-effort: every call returns the parsed response dict or None and
never raises. The webhook runs inside a normal web request on a single
worker, so a slow or broken Telegram side must never fail the request.
"""

import json
import urllib.request

from django.conf import settings

_TIMEOUT = 10


def call(method: str, payload: dict):
    if not settings.TELEGRAM_BOT_TOKEN:
        return None
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}"
    request = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT) as response:
            return json.loads(response.read())
    except Exception:
        return None


def send_message(chat_id, text, reply_markup=None, parse_mode=None):
    payload = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    if parse_mode is not None:
        payload["parse_mode"] = parse_mode
    return call("sendMessage", payload)


def send_photo(chat_id, photo_url, caption=None, reply_markup=None, parse_mode=None):
    payload = {"chat_id": chat_id, "photo": photo_url}
    if caption is not None:
        payload["caption"] = caption
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    if parse_mode is not None:
        payload["parse_mode"] = parse_mode
    return call("sendPhoto", payload)


def answer_callback(callback_id, text=None):
    payload = {"callback_query_id": callback_id}
    if text:
        payload["text"] = text
    return call("answerCallbackQuery", payload)


def edit_message_text(chat_id, message_id, text, reply_markup=None, parse_mode=None):
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    if parse_mode is not None:
        payload["parse_mode"] = parse_mode
    return call("editMessageText", payload)
