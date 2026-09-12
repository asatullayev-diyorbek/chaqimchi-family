"""Groq inference for weekly AI insights. Plain urllib, matching the rest of
this codebase's external-API style (apps/devices/geoip.py,
apps/accounts/tg_api.py) — Groq's API is a bare OpenAI-shaped JSON endpoint,
so no client library is worth adding for one call site.

⚠️ GROQ_MODEL is not hardcoded here — Groq's lineup and pricing change, and
this project doesn't maintain a pricing/model reference for them. Confirm
the current model id and cost at https://console.groq.com before setting
GROQ_MODEL in production.

⚠️ PythonAnywhere's outbound IP range is blocked by Cloudflare in front of
api.groq.com (HTTP 403, "error code: 1010" — an ASN/datacenter block, not
anything wrong with the request). Confirmed by hand from a PA console.
Calls are routed through a tiny relay on Vercel instead
(parent-web/src/app/api/groq-relay/route.ts) when GROQ_RELAY_URL is set —
Vercel's IPs aren't on that block list. GROQ_RELAY_SECRET authenticates to
the relay; the real GROQ_API_KEY only needs to exist wherever the actual
call happens (the relay when routed through it, this process otherwise).
"""

import json
import logging
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 30
_DIRECT_API_URL = "https://api.groq.com/openai/v1/chat/completions"

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
    # Either a direct key (this process calls Groq itself) or a relay URL +
    # secret (the relay holds the real key) is enough — GROQ_MODEL is always
    # required since it's sent in the request body either way.
    has_credentials = bool(settings.GROQ_API_KEY) or bool(
        settings.GROQ_RELAY_URL and settings.GROQ_RELAY_SECRET
    )
    return bool(has_credentials and settings.GROQ_MODEL)


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

    if settings.GROQ_RELAY_URL and settings.GROQ_RELAY_SECRET:
        url = settings.GROQ_RELAY_URL
        headers = {"X-Relay-Secret": settings.GROQ_RELAY_SECRET, "Content-Type": "application/json"}
    else:
        url = _DIRECT_API_URL
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"}

    request = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
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
