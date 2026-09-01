import json
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


BOT_COMMANDS = [
    {"command": "bugun", "description": "Bugungi ekran vaqti va qolgan limit"},
    {"command": "ogohlantirishlar", "description": "Oxirgi ogohlantirishlar"},
    {"command": "qurilmalar", "description": "Qurilmalar holati"},
    {"command": "help", "description": "Yordam"},
]


class Command(BaseCommand):
    help = "Registers the Telegram bot webhook and its command menu."

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
