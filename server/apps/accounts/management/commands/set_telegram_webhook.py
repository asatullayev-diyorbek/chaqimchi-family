import json
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


BOT_COMMANDS = [
    {"command": "start", "description": "Boshlash / asosiy menyu"},
    {"command": "menyu", "description": "Asosiy menyu"},
    {"command": "bugun", "description": "Bugungi ekran vaqti va qolgan limit"},
    {"command": "qurilmalar", "description": "Qurilmalar holati"},
    {"command": "farzandlar", "description": "Farzandlar ro'yxati"},
    {"command": "ogohlantirishlar", "description": "Oxirgi ogohlantirishlar"},
    {"command": "yuklab_olish", "description": "O'rnatish qo'llanmasi"},
]

BOT_DESCRIPTION = (
    "Spino24 — oilaviy raqamli farovonlik. Farzandingiz qancha va qanday vaqt "
    "sarflayotganini ko'rsatadi: ekran vaqti, ilovalar, qoidalar va "
    "ogohlantirishlar. Yozishmalar, parollar, kamera va klaviatura yig'ilmaydi. "
    "Boshlash uchun /start bosing."
)

BOT_SHORT_DESCRIPTION = (
    "Farzandingizning ekran vaqti va raqamli odatlari — bir joyda. Kuzatuv "
    "emas, tushuntirish."
)


class Command(BaseCommand):
    help = "Registers the Telegram webhook, command menu, description and chat menu button."

    def handle(self, *args, **options):
        if not settings.TELEGRAM_BOT_TOKEN:
            raise CommandError("TELEGRAM_BOT_TOKEN is not set")
        if not settings.TELEGRAM_WEBHOOK_SECRET:
            raise CommandError("TELEGRAM_WEBHOOK_SECRET is not set")

        webhook_url = f"{settings.CHAQIMCHI_PUBLIC_API_URL.rstrip('/')}/api/auth/telegram/webhook/"
        self._call(
            "setWebhook",
            {"url": webhook_url, "secret_token": settings.TELEGRAM_WEBHOOK_SECRET},
        )
        self.stdout.write(self.style.SUCCESS(f"Webhook set to {webhook_url}"))

        self._call("setMyCommands", {"commands": BOT_COMMANDS})
        self.stdout.write(self.style.SUCCESS(f"Registered {len(BOT_COMMANDS)} bot commands"))

        self._call("setMyDescription", {"description": BOT_DESCRIPTION})
        self._call("setMyShortDescription", {"short_description": BOT_SHORT_DESCRIPTION})
        self.stdout.write(self.style.SUCCESS("Description + short description set"))

        self._call(
            "setChatMenuButton",
            {
                "menu_button": {
                    "type": "web_app",
                    "text": "Ota-ona paneli",
                    "web_app": {"url": settings.PARENT_MINIAPP_URL},
                }
            },
        )
        self.stdout.write(
            self.style.SUCCESS(f"Chat menu button -> {settings.PARENT_MINIAPP_URL}")
        )

    @staticmethod
    def _call(method, payload):
        api_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}"
        request = urllib.request.Request(
            api_url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            body = json.loads(response.read())
        if not body.get("ok"):
            raise CommandError(f"Telegram {method} failed: {body}")
        return body
