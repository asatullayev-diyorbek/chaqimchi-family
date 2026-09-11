"""
Django settings for ChaqimchiAI Family server (Bosqich 0 — enrollment).
"""

import os
from datetime import timedelta
from pathlib import Path

from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-#xo(-_4v2@$eitc^j@n-a^(u6zk25y5w4@*a9hd!#p9tym!asa",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")


INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "channels",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "apps.accounts",
    "apps.devices",
    "apps.tracking",
    "apps.rules",
    "apps.alerts",
    "apps.deploy",
    "apps.screenshots",
    "apps.billing",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# parent-web calls this API directly from the browser (unlike parent-mobile,
# a native app with no CORS concept), so the allowed origin list has to be
# explicit — never "*", since these are authenticated JWT-bearing requests.
# CORS_ALLOWED_ORIGINS is a real env var (not hardcoded) so a deployed
# parent-web's actual origin can be added without touching code.
CORS_ALLOWED_ORIGINS = [
    origin
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://192.168.34.235:3000,https://chaqimchi-ai.uz,https://www.chaqimchi-ai.uz,"
        "https://guard.chaqimchi-ai.uz,"
        # Spino24 parent Mini App (Expo web). Local dev server + deployed host.
        "http://localhost:8081,http://127.0.0.1:8081,https://spino24.chaqimchi-ai.uz",
    ).split(",")
    if origin
]
# Local development is commonly opened from a phone or another computer on
# the same Wi-Fi. Permit only private-network origins while DEBUG is enabled;
# production remains restricted to the explicit HTTPS origins above.
CORS_ALLOWED_ORIGIN_REGEXES = [
    # Spino24 parent Mini App on Vercel (preview + production deploys).
    r"^https://spino24[a-z0-9-]*\.vercel\.app$",
] + (
    [
        r"^http://(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}):(?:3000|8081)$"
    ]
    if DEBUG
    else []
)
# Ngrok's free browser warning can otherwise replace API responses with an
# HTML page that has no CORS headers. Parent clients send this header only for
# ngrok URLs; it must be included in Django's preflight response.
CORS_ALLOW_HEADERS = [*default_headers, "ngrok-skip-browser-warning"]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# Database — Postgres in prod (via env vars), sqlite fallback for local dev
# so this project runs out of the box without extra infra.
if os.environ.get("DATABASE_NAME"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["DATABASE_NAME"],
            "USER": os.environ.get("DATABASE_USER", "postgres"),
            "PASSWORD": os.environ.get("DATABASE_PASSWORD", ""),
            "HOST": os.environ.get("DATABASE_HOST", "localhost"),
            "PORT": os.environ.get("DATABASE_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.ParentUser"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
# Single-region product (Uzbekistan). Storing UTC but grouping the daily
# breakdown by this zone keeps evening activity on the right calendar day.
TIME_ZONE = os.environ.get("DJANGO_TIME_ZONE", "Asia/Tashkent")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = os.environ.get("DJANGO_STATIC_ROOT", BASE_DIR / "staticfiles")

# Local static-file serving for agent binaries in this bosqich (Bosqich 4
# scope explicitly excludes real S3/CDN hosting — AgentVersion.binary_url
# can point here for local testing, e.g. http://localhost:8000/media/agent-builds/...).
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Local, versioned Windows build directory used by the public test-download
# page. Production deployments can override this with CHAQIMCHI_RELEASES_DIR.
RELEASES_DIR = os.environ.get("CHAQIMCHI_RELEASES_DIR", BASE_DIR.parent / "releases" / "windows")
CHAQIMCHI_PUBLIC_API_URL = os.environ.get(
    "CHAQIMCHI_PUBLIC_API_URL", "https://ora-splittable-illuminatedly.ngrok-free.dev"
)

# Public parent-web origin, used for deep links in Telegram notifications.
PARENT_WEB_URL = os.environ.get("PARENT_WEB_URL", "https://guard.chaqimchi-ai.uz")

# Spino24 parent Mini App (Telegram Web App) origin — the bot's menu button
# and onboarding buttons open this.
PARENT_MINIAPP_URL = os.environ.get("PARENT_MINIAPP_URL", "https://spino24.chaqimchi-ai.uz")

# Where the bot's onboarding illustrations are served from (parent-web
# public/bot/). Bot sendPhoto calls reference <base>/<slug>.png.
BOT_ASSET_BASE_URL = os.environ.get(
    "BOT_ASSET_BASE_URL", "https://guard.chaqimchi-ai.uz/bot"
).rstrip("/")

# Telegram login (see apps/accounts/telegram.py). Empty until a bot is
# created via @BotFather and these are set in the hosting environment.
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.environ.get("TELEGRAM_BOT_USERNAME", "")
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")

# Shared secret an external cron sends to POST /api/tracking/digest/run/ so
# the daily Telegram digest can fire without a paid scheduler.
DIGEST_CRON_SECRET = os.environ.get("DIGEST_CRON_SECRET", "")

# Payme / Click merchant credentials (apps.billing). Empty until a real
# merchant account exists — every billing endpoint that needs them checks
# is_configured() first and 503s rather than crash. See apps/billing/payme.py
# and click.py for exactly what each key is used for and the "never tested
# against a real sandbox yet" caveat.
PAYME_MERCHANT_ID = os.environ.get("PAYME_MERCHANT_ID", "")
PAYME_MERCHANT_KEY = os.environ.get("PAYME_MERCHANT_KEY", "")
CLICK_MERCHANT_ID = os.environ.get("CLICK_MERCHANT_ID", "")
CLICK_SERVICE_ID = os.environ.get("CLICK_SERVICE_ID", "")
CLICK_SECRET_KEY = os.environ.get("CLICK_SECRET_KEY", "")

# Telegram user ids that get an operator DM when a new parent finishes
# onboarding or a device is linked. Comma-separated; default is the
# founder's account (@diyorbek_asatullayev). Override per environment.
ADMIN_TELEGRAM_IDS = os.environ.get("ADMIN_TELEGRAM_IDS", "5547740249")
TELEGRAM_TOKEN_TTL_MINUTES = 10

# --- Real-time screenshot feature -------------------------------------------
# Cloudflare R2 (S3-compatible) holds the captured images — PythonAnywhere
# Free's disk is too small and they're large/short-lived. Empty until the
# R2_* vars are set in the hosting env; every screenshot endpoint returns
# 503 (not 500) while unset. The bucket is PRIVATE: the agent uploads with a
# presigned PUT, the parent views with a short-TTL presigned GET.
R2_ENDPOINT_URL = os.environ.get("R2_ENDPOINT_URL", "")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_SCREENSHOT_BUCKET = os.environ.get("R2_SCREENSHOT_BUCKET", "spino24-screenshots")

# Max accepted JPEG size and how often one parent may capture one device.
SCREENSHOT_MAX_BYTES = int(os.environ.get("SCREENSHOT_MAX_BYTES", str(8 * 1024 * 1024)))
SCREENSHOT_RATE_PER_HOUR = int(os.environ.get("SCREENSHOT_RATE_PER_HOUR", "6"))

# Shared secret an external cron sends to POST /api/screenshots/cleanup/
# (header X-Screenshots-Secret). Falls back to the digest secret so a single
# cron credential can drive both jobs if desired.
SCREENSHOTS_CRON_SECRET = os.environ.get("SCREENSHOTS_CRON_SECRET", "") or DIGEST_CRON_SECRET

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "apps.devices.authentication.DeviceSecretAuthentication",
    ),
}

# The default 5-minute access token made the dashboard 401 → refresh on
# almost every navigation; on the single-worker free host that burst of
# refresh calls is what makes pages hang or fail to load. A longer access
# token plus a long refresh window removes that storm.
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=12),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
}

# Redis-backed channel layer in prod; falls back to in-memory for local dev
# when REDIS_URL isn't set (single-process only — fine for Bosqich 0 testing).
if os.environ.get("REDIS_URL"):
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [os.environ["REDIS_URL"]]},
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }
