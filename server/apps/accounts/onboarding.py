"""Bot onboarding: a cold /start creates the account, then the parent must
send a phone number (Telegram request_contact, mandatory) before the app
unlocks. Also the drip reminder for parents who never finish.

Everything runs inside the webhook request (a few Bot API calls). All copy
is Uzbek and lives here so it can be edited in one place.
"""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from . import tg_api
from .models import ParentUser

# ---------------------------------------------------------------------------
# Assets & deep links
# ---------------------------------------------------------------------------

def img(slug: str) -> str:
    return f"{settings.BOT_ASSET_BASE_URL}/{slug}.png"


def download_url() -> str:
    return f"{settings.PARENT_WEB_URL.rstrip('/')}/download"


def miniapp_url() -> str:
    return settings.PARENT_MINIAPP_URL


def bot_url() -> str:
    return f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}"


# ---------------------------------------------------------------------------
# Keyboards
# ---------------------------------------------------------------------------

def _welcome_keyboard() -> dict:
    return {
        "inline_keyboard": [
            [{"text": "📥 Windows uchun yuklab olish", "url": download_url()}],
        ]
    }


def _phone_keyboard() -> dict:
    # Mandatory — no skip button.
    return {
        "keyboard": [[{"text": "📱 Telefon raqamni yuborish", "request_contact": True}]],
        "resize_keyboard": True,
        "one_time_keyboard": True,
        "is_persistent": False,
    }


# ---------------------------------------------------------------------------
# Copy
# ---------------------------------------------------------------------------

WELCOME_TEXT = (
    "Spino24 — oilaviy raqamli farovonlik xizmati.\n\n"
    "Farzandingiz nima qilayotganini emas, qancha va qanday vaqt sarflayotganini "
    "ko'rsatadi: ekran vaqti, ilovalar, qoidalar, ogohlantirishlar va so'rov "
    "bo'yicha ekran rasmi.\n\n"
    "Yig'ilmaydi: yozishmalar, parollar, kamera va mikrofon, klaviatura bosishlari.\n\n"
    "Boshlash uchun pastdan telefon raqamingizni yuboring."
)

PHONE_PROMPT_TEXT = (
    "Telefon raqamingizni yuboring\n\n"
    "Bu hisobingizni himoyalaydi va kerak bo'lganda yordam ko'rsatish uchun "
    "ishlatiladi. Raqam faqat sizning hisobingizga bog'lanadi, boshqa hech "
    "kimga berilmaydi.\n\n"
    "Pastdagi «📱 Telefon raqamni yuborish» tugmasini bosing."
)

PHONE_THANKS_TEXT = (
    "Rahmat! ✅ Hisobingiz tayyor.\n\n"
    "Endi farzand qurilmasiga Spino24'ni o'rnatishingiz mumkin."
)

WRONG_CONTACT_TEXT = (
    "Iltimos, o'zingizning telefon raqamingizni yuboring — pastdagi tugma orqali."
)

NEED_PHONE_TEXT = (
    "Avval telefon raqamingizni yuboring — shundan keyin barcha imkoniyatlar ochiladi."
)


def install_guide_text() -> str:
    return (
        "📥 O'rnatish — 4 qadam\n\n"
        f"1. Farzand kompyuterida (Windows 10/11) oching: {download_url()}\n"
        "   «Rasmiy o'rnatuvchi» bo'limidan .exe faylni yuklab oling.\n\n"
        "2. Faylni ishga tushiring. Windows «Noma'lum noshir» desa: "
        "«More info» → «Run anyway».\n\n"
        "3. Ekranda shaffoflik oynasi chiqadi — o'qib tasdiqlang. "
        "So'ng QR kod ko'rsatiladi.\n\n"
        "4. Shu botdagi «📱 Ota-ona paneli» tugmasini oching → «Qurilma ulash» → "
        "QR kodni skanerlang (yoki 6 xonali kodni kiriting).\n\n"
        "📱 Android va iOS uchun ilova — tez orada."
    )


# Drip reminders: fire at ~day 1 / 3 / 7 after signup, at most one per 48h,
# stop after 3.
REMINDER_DAY_THRESHOLDS = [1, 3, 7]
REMINDER_MIN_GAP = timedelta(hours=48)
REMINDER_TEXTS = [
    "Spino24'dan foydalanishni boshlash uchun bitta qadam qoldi — telefon "
    "raqamingizni yuboring. Bu bir necha soniya vaqt oladi.",
    "Eslatma: hisobingiz hali to'liq faollashmagan. Telefon raqamingizni "
    "yuborsangiz, farzand qurilmasini ulashingiz mumkin bo'ladi.",
    "Oxirgi eslatma: telefon raqamingizni yuborib, Spino24'ni ishga tushiring. "
    "Bundan keyin eslatma yubormaymiz.",
]


# ---------------------------------------------------------------------------
# Phone normalisation
# ---------------------------------------------------------------------------

def normalize_phone(raw: str) -> str:
    """Telegram sends e.g. "998901234567" or "+998 90 123 45 67". Fold to
    "+<digits>"."""
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())
    if not digits:
        return ""
    return "+" + digits


# ---------------------------------------------------------------------------
# Flow
# ---------------------------------------------------------------------------

def send_phone_prompt(chat_id):
    tg_api.send_photo(chat_id, img("phone-trust"), caption=PHONE_PROMPT_TEXT,
                      reply_markup=_phone_keyboard())


def start_onboarding(from_user: dict, chat_id):
    """Cold /start from an unlinked Telegram user: create the account and
    begin onboarding. Returns the ParentUser."""
    telegram_id = from_user.get("id")
    username = from_user.get("username", "") or ""
    full_name = " ".join(
        p for p in [from_user.get("first_name", ""), from_user.get("last_name", "")] if p
    ).strip()

    parent = ParentUser.objects.filter(telegram_id=telegram_id).first()
    if parent is None:
        parent = ParentUser.objects.create_telegram_user(
            telegram_id=telegram_id, telegram_username=username, full_name=full_name
        )
    elif not parent.onboarding_required:
        # Already onboarded — nothing to do here; caller shows the menu.
        return parent

    tg_api.send_photo(chat_id, img("welcome-hero"), caption=WELCOME_TEXT,
                      reply_markup=_welcome_keyboard())
    send_phone_prompt(chat_id)
    return parent


def handle_contact(message: dict) -> bool:
    """A shared contact from the request_contact button. Returns True if it
    completed onboarding."""
    contact = message.get("contact") or {}
    from_id = (message.get("from") or {}).get("id")
    chat_id = (message.get("chat") or {}).get("id")

    # Only the sender's own contact — a forwarded contact card must not count.
    if contact.get("user_id") != from_id:
        tg_api.send_message(chat_id, WRONG_CONTACT_TEXT, reply_markup=_phone_keyboard())
        return False

    parent = ParentUser.objects.filter(telegram_id=from_id).first()
    if parent is None:
        tg_api.send_message(chat_id, "Avval /start buyrug'ini yuboring.")
        return False

    phone = normalize_phone(contact.get("phone_number", ""))
    parent.phone = phone
    parent.onboarding_required = False
    parent.save(update_fields=["phone", "onboarding_required"])

    tg_api.send_message(chat_id, PHONE_THANKS_TEXT, reply_markup={"remove_keyboard": True})
    tg_api.send_photo(chat_id, img("install-windows-steps"), caption=install_guide_text())

    from .botmenu import send_menu  # lazy: botmenu imports onboarding helpers
    send_menu(chat_id, parent)
    return True


def send_install_guide(chat_id):
    tg_api.send_photo(chat_id, img("install-windows-steps"), caption=install_guide_text())


# ---------------------------------------------------------------------------
# Drip reminders (called by the cron endpoint / mgmt command)
# ---------------------------------------------------------------------------

def run_onboarding_reminders(now=None) -> dict:
    now = now or timezone.now()
    candidates = ParentUser.objects.filter(
        onboarding_required=True,
        telegram_id__isnull=False,
        created_at__lte=now - timedelta(days=1),
    )
    reminded = 0
    checked = 0
    for parent in candidates:
        checked += 1
        sent = parent.onboarding_reminders_sent
        if sent >= len(REMINDER_TEXTS):
            continue
        if parent.last_onboarding_reminder_at and now - parent.last_onboarding_reminder_at < REMINDER_MIN_GAP:
            continue
        age_days = (now - parent.created_at).days
        if age_days < REMINDER_DAY_THRESHOLDS[sent]:
            continue

        tg_api.send_photo(
            parent.telegram_id,
            img("onboarding-reminder"),
            caption=REMINDER_TEXTS[sent],
            reply_markup=_phone_keyboard(),
        )
        parent.onboarding_reminders_sent = sent + 1
        parent.last_onboarding_reminder_at = now
        parent.save(update_fields=["onboarding_reminders_sent", "last_onboarding_reminder_at"])
        reminded += 1

    return {"checked": checked, "reminded": reminded}
