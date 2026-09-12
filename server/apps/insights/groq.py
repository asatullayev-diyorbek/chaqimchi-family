"""Groq inference for weekly AI insights. Plain urllib, matching the rest of
this codebase's external-API style (apps/devices/geoip.py,
apps/accounts/tg_api.py) — Groq's API is a bare OpenAI-shaped JSON endpoint,
so no client library is worth adding for one call site.

⚠️ GROQ_MODEL is not hardcoded here — Groq's lineup and pricing change, and
this project doesn't maintain a pricing/model reference for them. Confirm
the current model id and cost at https://console.groq.com before setting
GROQ_MODEL in production.
"""

import json
import logging
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 30
_API_URL = "https://api.groq.com/openai/v1/chat/completions"

_SYSTEM_PROMPT = (
    "Siz Spino24 — bolalar uchun raqamli xavfsizlik dasturidagi yordamchisiz. "
    "Ota-onaga farzandining haftalik ekran faoliyati haqida qisqa, tushunarli va "
    "hukm qilmaydigan tahlil bering. Har doim o'zbek tilida, iliq va hamkorlik "
    "ruhida yozing — bolani ayblamang, ota-onaga amaliy tavsiyalar bering.\n\n"
    "Faqat quyidagi JSON formatida javob bering, boshqa hech narsa yozmang:\n"
    '{"summary": "2-3 gapli umumiy holat", '
    '"highlights": ["diqqatga molik narsa 1", "..."], '
    '"recommendations": ["amaliy tavsiya 1", "..."], '
    '"risk_level": "ok" | "watch" | "concern"}'
)


def is_configured() -> bool:
    return bool(settings.GROQ_API_KEY and settings.GROQ_MODEL)


def _build_user_prompt(week_data: dict) -> str:
    return (
        f"Farzand: {week_data['child_name']}\n"
        f"Hafta: {week_data['week_start']} — {week_data['week_end']}\n"
        f"Jami ekran vaqti: {week_data['total_minutes']} daqiqa\n"
        f"Kunlar bo'yicha (daqiqa): {json.dumps(week_data['daily_minutes'], ensure_ascii=False)}\n"
        f"Eng ko'p ishlatilgan ilovalar: {json.dumps(week_data['top_apps'], ensure_ascii=False)}\n"
        f"Eng ko'p tashrif buyurilgan saytlar: {json.dumps(week_data['top_domains'], ensure_ascii=False)}\n"
        f"Ogohlantirishlar (turi -> soni): {json.dumps(week_data['alerts'], ensure_ascii=False)}\n"
        f"O'rnatilgan qoidalar: {json.dumps(week_data['rules'], ensure_ascii=False)}\n"
    )


def generate_weekly_insight(week_data: dict) -> dict | None:
    """Calls Groq and returns a dict matching WeeklyInsight's fields
    (summary/highlights/recommendations/risk_level), or None on any
    failure — never raises, mirrors every other best-effort external call
    in this codebase."""
    if not is_configured():
        return None

    body = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(week_data)},
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }
    request = urllib.request.Request(
        _API_URL,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT) as response:
            data = json.loads(response.read())
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
    except Exception:
        logger.exception("Groq weekly insight generation failed")
        return None

    summary = str(parsed.get("summary") or "").strip()
    if not summary:
        return None
    risk_level = parsed.get("risk_level")
    if risk_level not in ("ok", "watch", "concern"):
        risk_level = "ok"
    return {
        "summary": summary,
        "highlights": [str(h) for h in (parsed.get("highlights") or [])][:10],
        "recommendations": [str(r) for r in (parsed.get("recommendations") or [])][:10],
        "risk_level": risk_level,
    }
