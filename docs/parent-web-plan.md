# Ota-ona web paneli (parent-web) — reja

Sana: 2026-09-01. Dizayn manbasi: `chaqimchiai-family-desktop-dizayn-talablari.md`.
Stack: Next.js 16 / React 19, `guard.chaqimchi-ai.uz` (Vercel, `main`'dan auto-deploy).

## Hozir bor (ishlaydi)

| Ekran | Holat |
|---|---|
| **Login / Signup** | username+parol + Telegram; signup email+parol |
| **Overview** | **bitta tanlangan farzand**: bugungi vaqt, haftalik bar, kategoriya donut, qoidalar xulosasi, oxirgi alertlar |
| **Faoliyat** | davr (kun/hafta/oy), 3 tab (ekran / tarix / saytlar), ilovalar jadvali, saytlar jadvali |
| **Qurilmalar** | ro'yxat + detal, rename, farzandga qayta biriktirish, unlink, yangi qurilma (QR/kod), batareya, agent versiyasi |
| **Qoidalar** | kunlik limit (bitta raqam), taqiqlangan ilovalar (chip) |
| **Ogohlantirishlar** | ro'yxat, sahifalash, ko'rilgan belgilash |
| **Bildirishnomalar** | Telegram ulash/uzish + har alert turi toggle (yangi) |
| Umumiy | ko'p-qurilma/farzand, topbar'da qurilma tanlagich, `useApiQuery` polling |

## Bo'shliqlar (dizayn hujjati + mahsulot)

---

### P1 — Sozlamalar sahifasi (§4.7) — **eng yaqin bo'shliq**

Hozir dashboard'da Sozlamalar sahifasi **umuman yo'q** (`/rules` "Qoidalar" ga aylantirildi).

- **Hisob:** email ko'rsatish, **parolni o'zgartirish** (backend: `POST /api/auth/password/change/`), to'liq ism tahrirlash.
- **Parolni unutdingizmi** (login sahifada havola yo'q). Telegram orqali tiklash real (bot bor) — email SMTP PA Free'da cheklangan. Telegram-based: "parolni tiklash kodi" botga yuboriladi.
- **Yordam:** FAQ + bog'lanish (statik).
- **Bildirishnomalar** → allaqachon `/notifications` da; Sozlamalar hub'iga havola qilinadi yoki ko'chiriladi.
- **Oila a'zolari** (2-ota-ona taklifi) — keyinga (invite oqimi).
- **Obuna/Billing** — keyinga (to'lov yo'q).

**Hajm:** o'rta. Backend: `password/change` + (ixtiyoriy) Telegram reset. Web: 1 sahifa.

### P2 — Overview: haqiqiy ko'p-farzandli oila ko'rinishi (§4.2)

Hozir Overview **bitta farzand** ko'rsatadi. Dizayn: **kartochka to'ri** —
har farzand uchun karta (ism, onlayn nuqta, bugungi vaqt, alert belgisi) +
"Qurilma qo'shish" kartasi. Karta bosilsa → hozirgi bitta-farzand detali.

- Kartochka to'ri (`getChildren` + har biri uchun `getSummary`)
- Pastda: **barcha farzandlar haftalik solishtirma bar chart** (har farzand alohida rang)
- Hozirgi detal ko'rinishi `/overview?child=<id>` yoki alohida route

**Hajm:** o'rta. Faqat frontend (endpointlar bor).

### P3 — Qoidalar: hafta kuni bo'yicha limit + vaqt oynalari (§4.5)

- **Kunlik limit → hafta kuniga** (Dush–Yak yoki Ish kunlari / Dam olish). Backend
  rule value o'zgaradi (`{"minutes": N}` → `{"per_weekday": {...}}` yoki yangi tur).
  **Agent enforcer ham o'zgaradi** (`CheckDailyLimit` hafta kunini biladi).
- **Vaqt oynalari** ("22:00–07:00 bloklansin") — yangi rule turi `blocked_window`;
  **agent hozir vaqt bo'yicha bloklashni bilmaydi** — yangi enforcement kerak;
  UI: vizual timeline.
- "Saqlandi ✓" indikatori.

**Hajm:** katta (agent + backend + web). Vaqt oynalari eng chuqur.

### P4 — Faoliyat sayqal (§4.3)

- **Ilova kategoriyasi** (ta'lim / o'yin / ijtimoiy / boshqa) — `appDisplay.ts` kabi
  klient registri yoki backend. `CategoryDonut` bor, lekin kategoriya manbasi?
- Ilovalar jadvali ustunlari bo'yicha saralash
- **Eksport** (PDF/CSV) — "Hisobotni yuklab olish". Bu disabled "Hisobotlar" nav
  elementiga bog'lanadi.
- Maxsus sana oralig'i (hozir faqat kun/hafta/oy preset)

**Hajm:** o'rta. Kategoriya klassifikatsiyasi asosiy ish.

### P5 — Ogohlantirishlar: filtrlash (§4.4)

- Tur / sana / ko'rilgan-ko'rilmagan bo'yicha filtr
- Qatorga bosilganda detal (modal yoki yon panel)

**Hajm:** kichik. Faqat frontend + `getAlerts` ga query param (yoki klient-side filtr).

### P6 — Ko'ndalang sayqal

- **Liquid Glass** dizayn o'tishi (§5) — frosted-glass kartalar, hozirgi CSS tekshiriladi
- Responsive: sidebar collapse < 1024px (§6)
- Bo'sh / xato holatlar auditi (§7)
- Disabled "Hisobotlar" nav — P4 eksport bilan yoqiladi yoki olib tashlanadi
- Nav uzayib ketyapti (Bosh/Faoliyat/Qurilmalar/Qoidalar/Bildirishnomalar/Sozlamalar/Hisobotlar) — guruhlash
- "Yuklanmoqda..." matni o'rniga skeleton

## Tavsiya etilgan tartib

1. **P1** — Sozlamalar (parol o'zgartirish + parolni unutish). Aniq bo'shliq, orta hajm.
2. **P2** — Overview ko'p-farzandli (dizaynning bош ekrani). Faqat frontend.
3. **P5** — Alert filtr. Kichik, tez.
4. **P4** — Faoliyat kategoriya + eksport.
5. **P3** — Qoidalar (hafta kuni + vaqt oynasi) — agent ishi ham kerak.
6. **P6** — sayqal.

## Backend ta'siri

- P1: `password/change` endpoint + migration yo'q; Telegram reset — yangi token turi.
- P3: rule value sxemasi + agent enforcer + migration.
- P4: kategoriya — klient-side bo'lsa backend yo'q; server-side bo'lsa `app_category` field.
- P5: `getAlerts` ga filter query param (yoki klient-side).
- parent-web → Vercel auto-deploy.
