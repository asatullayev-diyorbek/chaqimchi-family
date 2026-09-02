# marketing — ChaqimchiAI Family sotuv sayti

`chaqimchi-ai.uz` (+ `www.`) uchun statik landing page. Ilova
(`guard.chaqimchi-ai.uz`) `parent-web/` da, alohida Vercel loyihasi.

## Ishga tushirish

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # prod build tekshiruvi
```

## Tuzilishi

- `src/lib/site.ts` — barcha tashqi URL va matn konstantalari
- `src/app/page.tsx` — bitta sahifa, bo'limlar
- `src/app/globals.css` — Liquid Glass tokenlar (parent-web bilan bir tizim)
- `/download` → `guard.chaqimchi-ai.uz/download` ga redirect (`.exe` va hash o'sha yerda)

## Deploy (bir marta)

Vercel → yangi loyiha → Root Directory: `marketing` → Framework: Next.js.
Domenlar: `chaqimchi-ai.uz`, `www.chaqimchi-ai.uz`. `main` push → auto-deploy.
Reja: `docs/landing-page-plan.md`.
