# Sotuv landing page — reja va implementatsiya

Sana: 2026-09-02. Manba: `docs/chaqimchiai-family-loyiha-konsepsiyasi.md`.

## Qaror: alohida `marketing/` Next.js ilovasi

| | Sabab |
|---|---|
| **Domen** | `chaqimchi-ai.uz` + `www.chaqimchi-ai.uz` (apex). Ilova `guard.chaqimchi-ai.uz` da qoladi. |
| **Nega alohida app** | Sotuv sahifasi ilovadan mustaqil deploy bo'ladi, marketing matnini o'zgartirish ilova build'iga tegmaydi, o'z SEO / OG / analytics'i. Standart `www` vs `app` bo'linishi. |
| **Stack** | Next.js 16 App Router, statik (SSG), `next/font` Inter, tashqi og'ir kutubxonasiz. |
| **Til** | O'zbek (`lang="uz"`). |
| **Dizayn** | Liquid Glass, ko'k `#2563eb` / `#60a5fa`, teal ijobiy, amber ehtiyot — `parent-web` bilan bir tizim. |

## Pozitsiya (konsepsiya §1)

Bosh xabar: **"Oila uchun ochiq ekran-vaqt qoidalari — yashirin kuzatuv emas."**
Uch va'da: **Shaffoflik · Xotirjam boshqaruv · Offline barqarorlik**.

## Sahifa tuzilishi (bitta sahifa, bo'limlar)

1. **Nav** — logo, "Imkoniyatlar / Qanday ishlaydi / Narx / FAQ", CTA: "Kirish" (`guard.…`), "Yuklab olish"
2. **Hero** — sarlavha + tagline + 2 CTA (Yuklab olish / Panelga kirish) + mahsulot vizuali (dashboard mock / glass kartalar)
3. **Shaffoflik bloki** — "Bu jazolash yoki josuslik vositasi emas": bola agentni ko'radi, nima yozilishini biladi, qoidalar ochiq
4. **Imkoniyatlar to'ri** (6 karta):
   - Kunlik ekran vaqti limiti (+ hafta kuni / dam olish kuni)
   - Dam olish vaqti oynalari (22:00–07:00 kabi)
   - Ilovalarni cheklash
   - Faoliyat: qaysi ilova, qancha vaqt (ikonka bilan)
   - Ogohlantirishlar: limit tugadi, cheklangan ilova, kattalar paneli
   - Telegram bot + kunlik hisobot
5. **Qanday ishlaydi** (3 qadam): O'rnat + QR bilan bog'la → Qoidalarni belgila → Xotirjam kuzat
6. **Platformalar** — Windows agent (hozir), ota-ona web paneli, mobil ilova (Expo)
7. **Narx** — MVP/Beta davrida bepul; keyinchalik oilaviy obuna
8. **FAQ** — SmartScreen ogohlantirishi, nima yoziladi / nima yozilmaydi, offline, o'chirish, bir nechta bola
9. **Yakuniy CTA + Footer** — yuklab olish, panelga kirish, `@ChaqimchiGuardBot`, hujjatlar, aloqa

## Implementatsiya (fayllar)

```
marketing/
  package.json  tsconfig.json  next.config.ts  eslint.config.mjs  .gitignore  README.md
  src/app/layout.tsx        # Inter font, metadata, OG
  src/app/page.tsx          # bo'limlarni yig'adi
  src/app/globals.css       # glass tokenlar + layout
  src/app/sitemap.ts  robots.ts
  src/components/Nav.tsx  Hero.tsx  Transparency.tsx  Features.tsx
  src/components/Steps.tsx  Platforms.tsx  Pricing.tsx  Faq.tsx  Footer.tsx
  src/lib/site.ts           # URL'lar, konfiguratsiya bir joyda
```

Yuklab olish tugmasi `https://guard.chaqimchi-ai.uz/download` ga ketadi (fayl va
hash o'sha yerda, `release.json` dan). Marketing app o'zi `.exe` tutmaydi.

## Deploy (bir marta, brauzerda)

1. Vercel'da yangi loyiha: root `marketing/`, framework Next.js.
2. Domen: `chaqimchi-ai.uz` + `www.chaqimchi-ai.uz` (www → apex redirect).
3. `main` push → auto-deploy.
4. `guard.chaqimchi-ai.uz` o'zgarmaydi (alohida loyiha, `parent-web/`).

## Keyingi (ixtiyoriy)

- OG rasm (`opengraph-image.tsx`)
- Haqiqiy dashboard skrinshotlari (hozir CSS mock)
- Analytics (Vercel Analytics)
- `docs/` ni public qilib qo'llanma sahifasi
