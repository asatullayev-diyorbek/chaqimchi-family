import json
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Registers this deployment's public URL as the Telegram bot's webhook."

    def handle(self, *args, **options):
        if not settings.TELEGRAM_BOT_TOKEN:
            raise CommandError("TELEGRAM_BOT_TOKEN is not set")
        if not settings.TELEGRAM_WEBHOOK_SECRET:
            raise CommandError("TELEGRAM_WEBHOOK_SECRET is not set")

        webhook_url = f"{settings.CHAQIMCHI_PUBLIC_API_URL.rstrip('/')}/api/auth/telegram/webhook/"
        api_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/setWebhook"
        payload = json.dumps(
            {"url": webhook_url, "secret_token": settings.TELEGRAM_WEBHOOK_SECRET}
        ).encode()
        request = urllib.request.Request(
            api_url, data=payload, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            body = json.loads(response.read())

        if not body.get("ok"):
            raise CommandError(f"Telegram setWebhook failed: {body}")

        self.stdout.write(self.style.SUCCESS(f"Webhook set to {webhook_url}"))
