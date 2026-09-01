# Ota-ona paneli — Telegram bot integratsiyasi rejasi

Sana: 2026-09-01
Bot: `@ChaqimchiGuardBot` (token WSGI env'da). Webhook:
`POST /api/auth/telegram/webhook/` (secret-token auth, `set_telegram_webhook` cmd).

## Hozir nima bor

- **Telegram orqali kirish/ro'yxatdan o'tish** (`apps/accounts/telegram.py`) —
  short-lived pairing token + webhook confirm. `ParetUser.telegram_id` saqlanadi
  (private chatda `telegram_id == chat_id`).
- **Bitta alert turi** Telegram'ga yuboriladi: `settings_panel_access`
  (`apps/alerts/notifications.py`, `send_text()` helper).
- `_telegram_api_call` / `send_text` — urllib, best-effort, 10s timeout,
  **so'rov ichida sinxron** (xato hech qachon report'ni buzmaydi).

## Qattiq cheklovlar (arxitekturani belgilaydi)

1. **PythonAnywhere Free = WSGI-only.** Uzoq ishlaydigan bot jarayoni yo'q,
   polling yo'q. Hamma narsa **webhook** orqali (Telegram bizni chaqiradi).
2. **PA Free CPU limiti ~100 s/kun.** Alert kelganda N ta Telegram xabar
   yuborish — so'rovga latency + CPU qo'shadi. 1-2 ota-onali oila uchun
   muammo emas (~0.5 s). Navbat/worker yo'q.
3. **PA Free: 1 ta scheduled task/kun.** Kunlik digest shuning uchun.
4. Barcha matn — o'zbekcha.

---

## Bosqichlar

### P1 — Barcha alertlar Telegram'ga + bildirishnoma sozlamalari

**Backend:**
- `apps/alerts/notifications.py` — `TELEGRAM_ALERT_TYPES` ni kengaytirish:
  `limit_reached`, `blocked_app_opened`, `settings_panel_access`.
- Boyroq xabar: farzand ismi, qurilma, ilova nomi (payload'dan), vaqt +
  panelga deep link (`https://guard.chaqimchi-ai.uz/alerts?device=<id>`).
- Yangi model **`NotificationPreference`** (`apps/accounts` yoki `apps/alerts`):
  `parent (FK)`, `alert_type`, `via_telegram (bool, default True)`.
  `notify_parents_of_alert` shu jadvalga qaraydi.
- Migration + PA deploy.

**parent-web:**
- **Yangi `Sozlamalar` sahifasi** (hozir yo'q — dashboardda faqat
  activity/alerts/devices/overview/rules). Bo'limlar (desktop dizayn §4.7):
  - **Bildirishnomalar** — har alert turi uchun toggle (Telegram)
  - **Telegram** — "Ulangan: @username" yoki "Ulash" tugmasi (P2)
  - (keyingi: Hisob, Obuna)
- Sidebar'ga "Sozlamalar" qo'shish.

**Test:** `_telegram_api_call` mock (allaqachon bor), har alert turi uchun.

### P2 — Web paneldan Telegram ulash/uzish

Hozir Telegram faqat **kirish** uchun. Email bilan ro'yxatdan o'tgan ota-onada
`telegram_id` yo'q.

- **Ulash oqimi:** Sozlamalar → "Telegram ulash" → web pairing token
  yaratadi → bot deep link ochiladi → webhook confirm → `telegram_id` ni
  **joriy autentifikatsiyalangan** foydalanuvchiga bog'laydi (yangi user
  yaratmaydi). Login oqimidagi token patternini qayta ishlatadi, lekin
  `TelegramLinkToken` (auth talab qiladigan start).
- **Uzish:** `telegram_id = None`, bildirishnomalar to'xtaydi.
- `set_telegram_webhook` cmd'ga `setMyCommands` qo'shish (buyruq menyusi).

### P3 — Bot buyruqlari (faqat o'qish)

Ota-ona botga yozadi (webhook ichida javob, arzon: 1 DB query + sendMessage):

| Buyruq | Javob |
|---|---|
| `/start` (tokensiz) | menyu / yordam |
| `/bugun` | har farzand bo'yicha bugungi ekran vaqti + qolgan limit |
| `/ogohlantirishlar` | oxirgi ko'rilmagan alertlar (5 ta) |
| `/qurilmalar` | qurilmalar ro'yxati + onlayn holati + batareya |

**Auth:** `from.id` (telegram_id) ulangan `ParentUser` bilan mos kelishi shart.
Bo'lmasa: "Ilovadan Telegram'ni ulang."

### P4 — Alert xabarida inline tugmalar

`limit_reached` / `blocked_app_opened` xabarida:
- **"✓ Ko'rildi"** → alertni `seen=True` (callback, arzon)
- **"Panelda ochish"** → deep link (URL tugma, callback yo'q)

(Keyinroq: **"Bugun +30 daqiqa"** → kunlik limitni bugunga oshirish.
Buning uchun rules'da vaqtinchalik override kerak — hozir qoidalar doimiy.
Alohida feature.)

### P5 — Kunlik digest (scheduled task)

`send_daily_digest` management command (PA'da 1 ta scheduled task, ~20:00 Toshkent):
- Har Telegram-ulangan ota-onali oila uchun: kechagi jami ekran vaqti
  (farzandlar bo'yicha), top ilovalar, alert soni.
- `NotificationPreference` orqali opt-in (`digest` "alert_type").

---

## Ko'ndalang masalalar

- **Xato xabarlar:** `send_text` best-effort. Ota-ona botni bloklasa → xato.
  Ketma-ket N marta xato → `telegram_id` ni "stale" belgilash (nice-to-have).
- **Bot sozlamasi:** `setMyCommands` (buyruq menyusi), bot description/about
  (BotFather'da yoki `setMyDescription`).
- **Xavfsizlik:** webhook secret-token auth (bor). Buyruq auth — telegram_id →
  ParentUser. Ulanmagan telegram_id bo'yicha hech qachon harakat qilinmaydi.
- **i18n:** hamma matn o'zbekcha, markazlashtirilgan (bir joyda).

## Tavsiya etilgan tartib

1. **P1** — eng katta qiymat, kichik. NotificationPreference + Sozlamalar sahifasi + barcha alertlar.
2. **P2** — web'dan ulash/uzish (email-user'lar uchun).
3. **P3** — o'qish buyruqlari.
4. **P4** — inline "Ko'rildi" + deep link.
5. **P5** — kunlik digest.
6. Keyin — interaktiv limit berish (P4 kengaytmasi).

## Deploy ta'siri

- P1, P5 → migration (`NotificationPreference`) → PA Files API upload + migrate + reload.
- `setMyCommands` → bir martalik (`set_telegram_webhook` cmd kengaytmasi).
- Webhook allaqachon o'rnatilgan.
- parent-web → Vercel auto (Sozlamalar sahifasi).
