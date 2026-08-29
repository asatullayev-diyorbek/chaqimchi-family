# parent-web — tuzatish rejasi (implementation plan)

**Juftlik hujjat:** `features.md` — *nima buzuq* (audit).
Bu hujjat — *qanday tuzatiladi* (bajarish rejasi).

Har vazifa: **Maqsad → Fayllar → Yondashuv (kod) → Tekshirish → Commit**.
Tartib muhim: keyingi vazifalar oldingisining natijasига tayanadi.

---

## Ish qoidalari

1. **Bitta vazifa = bitta commit.** Aralashtirmaslik — regressiyani topish oson bo'lsin.
2. Har commitдan oldin: `npx tsc --noEmit && npx eslint src && npx next build` — 0 xato.
3. Har bosqich oxirида §6 dagi **regressiya ro'yxati** qo'lда o'tkaziladi.
4. **Backend kontraktига tegilmaydi** — bu faqat frontend ishi. Istisno: P2-9
   (build skripti download metadata'sini yozadi).
5. Mock data qo'shilmaydi. Ishlamaydigan tugma qo'shilmaydi.
6. Mavjud dizayn tili (glass karta, ko'k accent, yumaloq burchak) saqlanadi.

---

# 1-BOSQICH — Blockerlar

> Natija: dark rejim to'liq ishlaydi va saqlanadi, Telegram login tez,
> barcha modal'lar klaviatura/skrinrider uchun ochiq.

---

## 1.1 — Telegram polling cache'ни chetlab o'tsin  `P0-1`

**Maqsad:** polling har safar serverга borsin, cache'дан emas.

**Fayllar:** `src/api/client.ts`, `src/api/auth.ts`

**Yondashuv** — `ApiFetchOptions`ga `noCache` qo'shish (eng kam ta'sirli yechim;
mavjud cache mantiqи tegilmaydi):

```ts
// client.ts
type ApiFetchOptions = RequestInit & { skipAuth?: boolean; noCache?: boolean };

export async function apiFetch(
  path: string,
  { skipAuth = false, noCache = false, ...options }: ApiFetchOptions = {}
) {
  ...
  const isGet = method === "GET" && !noCache;   // ← yagona o'zgarish
```

`isGet` allaqachon cache o'qish/yozish va in-flight dedup'ni boshqaradi, shuning
uchun bitta qator butun yo'lni yopadi.

```ts
// auth.ts
export async function telegramStatus(token: string): Promise<TelegramStatus> {
  const result = (await apiFetch(`/api/auth/telegram/status/${token}/`, {
    skipAuth: true,
    noCache: true,          // ← polling: har safar yangi javob
  })) as TelegramStatus;
  ...
}
```

**Nima uchun bu yondashuv:** muqobil variant — cache'ni faqat authenticated
GET'larга qo'llash — `/api/deploy/*` kabi kelajakдаgi anonim GET'larни ham
cache'siz qoldirar edi. Aniq `noCache` bayrog'i niyatni ochiq ko'rsatadi.

**Tekshirish:**
1. DevTools → Network → `telegram/status` — 800 ms oralиqда **har safar** yangi
   so'rov ketishi (`(from disk cache)` emas).
2. Telegram'да tasdiqlash → ≤ 2 soniyада `/overview`.
3. Boshqa GET'lar hali ham cache'lanishi: `/overview` → `/activity` → `/overview`
   almashganда `devices/` bitta marta chaqirilishi.

**Commit:** `api: bypass the GET cache for Telegram login polling`

---

## 1.2 — Dark rejim uchun to'liq token to'plami  `P0-2`

**Maqsad:** `var(--*)` ishlatgan har bir joy (92 ta inline + butun CSS) dark
rejimда avtomat to'g'ri rangга o'tsin.

**Fayllar:** `src/app/globals.css` (asosiy), keyin chart komponentlari

### 1.2a — Tokenlarni dark uchun qayta e'lon qilish

`globals.css` oxiriga:

```css
:root[data-theme="dark"] {
  color-scheme: dark;

  --background: #111827;
  --surface: #1b2534;
  --foreground: #e8edf5;
  --muted: #94a3b8;
  --border: #2b3648;

  --brand-blue: #60a5fa;      /* qora fonда kontrast uchun ochiqroq */
  --accent: #34d3b8;
  --accent-dark: #2fbfa6;
  --warning: #fbbf24;
  --danger: #f87171;

  --sidebar-bg: rgba(27, 37, 52, .72);
  --sidebar-fg: #a8b4c4;
  --sidebar-active-fg: #93c5fd;
  --sidebar-active-bg: linear-gradient(120deg, rgba(96,165,250,.20), rgba(129,140,248,.12));
  --sidebar-active-border: rgba(96,165,250,.30);
  --sidebar-disabled: #5b6878;

  /* kategoriya ranglari — to'yingan fon, ochiq matn */
  --cat-teal: #2fd8bb;   --cat-teal-bg: rgba(47,200,173,.16);
  --cat-blue: #8ab4ff;   --cat-blue-bg: rgba(111,151,240,.18);
  --cat-amber: #f7cd6b;  --cat-amber-bg: rgba(245,192,78,.16);
  --cat-purple: #c4b5fd; --cat-purple-bg: rgba(167,139,250,.18);
  --cat-slate: #94a3b8;  --cat-slate-bg: rgba(148,163,184,.16);

  --glass-bg: rgba(27, 37, 52, .62);
  --glass-bg-strong: rgba(27, 37, 52, .86);
  --glass-border: rgba(255,255,255,.08);
  --glass-highlight: rgba(255,255,255,.06);
  --glass-shadow: 0 8px 24px rgba(0,0,0,.35);
  --glass-sidebar-bg: rgba(27, 37, 52, .72);
  --glass-sidebar-border: rgba(255,255,255,.08);
  --glass-sidebar-highlight: rgba(255,255,255,.05);
}
```

### 1.2b — Chart uchun yangi tokenlar

Light (`:root`) va dark ikkalasига:

```css
:root {
  --chart-grid:       rgba(37,99,235,.12);
  --chart-track:      rgba(37,99,235,.045);
  --chart-axis:       #9aa6b6;
  --chart-bar:        #a9c9fb;
  --chart-bar-active: #2563eb;
  --tooltip-bg:       #1f2b3a;
  --tooltip-fg:       #ffffff;
  /* timeline bucket'lari */
  --bucket-app:     #2563eb;
  --bucket-work:    #8b5cf6;
  --bucket-system:  #f97316;
  --bucket-blocked: #94a3b8;
}

:root[data-theme="dark"] {
  --chart-grid:       rgba(148,163,184,.18);
  --chart-track:      rgba(148,163,184,.10);
  --chart-axis:       #7b8798;
  --chart-bar:        #3b5a86;
  --chart-bar-active: #60a5fa;
  --tooltip-bg:       #0b1220;
  --tooltip-fg:       #e8edf5;
  --bucket-app:     #60a5fa;
  --bucket-work:    #a78bfa;
  --bucket-system:  #fb923c;
  --bucket-blocked: #94a3b8;
}
```

### 1.2c — Komponentlardaги hex'larni almashtirish

| Fayl | Almashtiriladigan |
|---|---|
| `ScreenTimeChart.tsx` | `#2563eb`→`var(--chart-bar-active)`, `#a9c9fb`→`var(--chart-bar)`, `#9aa6b6`→`var(--chart-axis)`, `#7a8698`→`var(--muted)`, `#1f2b3a`→`var(--foreground)`, grid `rgba(37,99,235,.12)`→`var(--chart-grid)` |
| `DayTimeline.tsx` | `BUCKET_META` ranglari → `var(--bucket-*)`; `#9aa6b6`→`var(--chart-axis)`; track/grid → `var(--chart-track)` / `var(--chart-grid)`; tooltip → `var(--tooltip-bg)` / `var(--tooltip-fg)` |
| `CategoryDonut.tsx` | tooltip `#1f2b3a`→`var(--tooltip-bg)`, `#93b4ff` → `var(--brand-blue)`; `#fff`→`var(--tooltip-fg)` |
| `AppIcon.tsx` | ikonка foni `#fff` → `var(--surface)`; ramka → `var(--border)` |

> **Eslatma:** SVG `fill`/`stroke` atributlari `var()` ni qabul qiladi (SVG2 +
> barcha zamonaviy brauzer). Agar biror joyда ishlamasa — `style={{ fill: "var(--x)" }}`
> ga o'tkaziladi.

### 1.2d — Ortiqcha bo'lib qolган dark override'larni tozalash

Token'lar ishlagach `style.css`даги 329 qatorlik qo'lда yozилган dark blokining
katta qismi keraksiz bo'ladi. **Bu alohida commit** — avval tokenlar ishlashига
ishonch hosil qilinadi, keyin blok qatorma-qator olib tashlanadi va har biri
vizual tekshiriladi. Shoshilmaslik: bu bosqich regressiya xavfи eng yuqori joy.

**Tekshirish:** §6 dagi ro'yxat, dark rejimда. Har sahifада:
matn/fon kontrasti ≥ 4.5:1 (DevTools → Inspect → Accessibility → Contrast).

**Commit'lar:**
1. `ui: define the full design-token set for dark theme`
2. `charts: use theme tokens instead of hardcoded hex`
3. `ui: drop hand-written dark overrides now covered by tokens`

---

## 1.3 — Tema tanlovi saqlansin  `P0-3`

**Maqsad:** dark rejim sahifа yangilanганда va keyingi tashrifда qolsin, FOUC
bo'lmasin.

**Fayllar:** `src/app/layout.tsx`, `src/components/layout/TopbarActions.tsx`,
yangi `src/lib/theme.ts`

**Yondashuv** — hydration'дан oldin ishlaydigan kichik blocking skript:

```tsx
// layout.tsx — <html> dagi qattiq data-theme="light" olib tashlanadi
<html lang="uz" suppressHydrationWarning>
  <head>
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{
          var t=localStorage.getItem('chaqimchi_theme');
          if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
          document.documentElement.setAttribute('data-theme',t);
        }catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
      }}
    />
    <Script src="https://code.iconify.design/..." strategy="afterInteractive" />
  </head>
```

```ts
// lib/theme.ts
export const THEME_KEY = "chaqimchi_theme";
export type Theme = "light" | "dark";

export function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
}
```

`TopbarActions` da `dark`/`themeReady`/`queueMicrotask` mantiqи shu ikki funksiyaга
almashtiriladi.

**Tekshirish:**
1. Dark yoqiladi → F5 → dark qoladi, **oq lipillash yo'q**.
2. Yangi tab → tizim temasиga mos ochiladi.
3. Private/incognito (localStorage bloklanган) → xato bermaydi, light'да ishlaydi.

**Commit:** `ui: persist the theme choice and apply it before hydration`

---

## 1.4 — Umumiy `<Modal>` komponenti  `P0-4`

**Maqsad:** uchala modal a11y-ga mos bo'lsin va bitta joyда boshqarilsin.

**Fayllar:** yangi `src/components/Modal.tsx`; ishlatuvchilar:
`TopbarActions.tsx:212`, `devices/page.tsx:214`, `devices/page.tsx:395`

**Yondashuv:**

```tsx
"use client";
import { useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Modal({
  open, onClose, title, subtitle, children, footer, maxWidth = 520,
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: React.ReactNode; footer?: React.ReactNode; maxWidth?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";           // scroll lock

    // birinchi fokuslanadigan elementга fokus
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus();                     // fokusni qaytarish
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        className="device-modal add-device-modal"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="add-device-modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Yopish">
            <iconify-icon icon="solar:close-circle-linear"></iconify-icon>
          </button>
        </div>
        <div className="add-device-body">{children}</div>
        {footer && <div className="add-device-footer">{footer}</div>}
      </div>
    </div>
  );
}
```

Diqqat qilinadigan joylar:
- `onMouseDown` + `e.target === e.currentTarget` — hozirgi `onClick` + `stopPropagation`
  naqshiда modal ichида matn tanlab, sichqonchani tashqарида qo'yib yuborsangiz
  modal yopilib ketadi. Bu shuni ham tuzatadi.
- `step-indicator` modal'ga xos emas — `children` ичида qoladi.
- Uchala chaqiruv joyида mavjud markup shu API'ga moslashtiriladi, CSS klasslari
  o'zgarmaydi → vizual farq bo'lmasligi kerak.

**Tekshirish:** har uch modalда:
1. `Escape` yopadi.
2. `Tab` faqat modal ichида aylanadi (oxиriдан birinchisига).
3. Yopilганда fokus ochган tugмаga qaytadi.
4. Ochilганда orqа sahifа scroll bo'lmaydi.
5. Ichида matn tanlab tashqарида qo'yib yuborilса — yopilmaydi.
6. VoiceOver/NVDA: ochilganда sarlavha o'qiladi.

**Commit:** `ui: shared accessible Modal (focus trap, Escape, scroll lock, ARIA)`

---

## 1.5 — `<ConfirmDialog>`  `P1-2`

**Maqsad:** `confirm()` o'rniga dizaynга mos tasdiq oynasi.

**Fayllar:** yangi `src/components/ConfirmDialog.tsx`;
`devices/page.tsx:123`, `devices/[id]/page.tsx:104`

```tsx
export default function ConfirmDialog({
  open, title, message, confirmLabel = "Tasdiqlash", danger = false,
  busy = false, onConfirm, onCancel,
}: { /* ... */ }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth={420}
      footer={
        <>
          <button className="add-device-btn outline" onClick={onCancel} disabled={busy}>Bekor qilish</button>
          <button className={`add-device-btn ${danger ? "danger" : "primary"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "Bajarilmoqda..." : confirmLabel}
          </button>
        </>
      }>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
```

Har ikki chaqiruv joyида `confirm()` → `useState` bilan boshqariladigan
`<ConfirmDialog>` ga o'tkaziladi. `busy` holati qo'shilishi bilan
«ikki marta bosish» muammosi ham yo'qoladi.

**Tekshirish:** farzandni o'chirish va qurilmани uzish — ikkalasида ham
brendlangan oyna, Escape bekor qiladi, jarayon davomида tugмаlar bloklanadi.

**Commit:** `ui: replace native confirm() with a branded ConfirmDialog`

---

# 2-BOSQICH — Barqarorlik va a11y

---

## 2.1 — Blob URL sizishini yopish  `P1-1`

**Fayllar:** `TopbarActions.tsx:245`, `devices/page.tsx:410`

```tsx
function useObjectUrl(file: File | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
```

`src/hooks/useObjectUrl.ts` sifatida chiqariladi, ikkала joyда ishlatiladi.

**Tekshirish:** DevTools → Memory → rasm tanlab modal'ni 10 marta ochib-yopish →
blob soni o'smasligi (`chrome://blob-internals`).

**Commit:** `fix: revoke object URLs for picked child photos`

---

## 2.2 — Dropdown'lar klaviatura + ARIA  `P1-3`

**Fayl:** `TopbarActions.tsx:138-208`

O'zgarishlar:
- `child-profile` div → `<button type="button">` (`role`/`tabIndex` shart emas)
- `aria-expanded={showProfiles}` `aria-haspopup="menu"` qo'shish
- dropdown ichидаgi `<a href="#">` → `<button type="button">`
- `Escape` → dropdown yopiladi va fokus toggle tugмаsига qaytadi
- `↑`/`↓` bilan elementlar orasида yurish
- tashqариga bosish: `mousedown` **va** `touchstart`

Reja: bu mantiqni `src/hooks/useDropdown.ts` ga chiqarish —
`{ open, setOpen, triggerProps, menuProps }` qaytaradi, ikkала dropdown ham
ishlatadi.

**Tekshirish:** faqat klaviatura bilan bildirishnoma va farzand dropdown'ini
ochish, ichида yurish, tanlash, Escape bilan yopish.

**Commit:** `ui: keyboard and ARIA support for the topbar dropdowns`

---

## 2.3 — Rules limitини atomik saqlash + tasdiq  `P1-5`

**Fayl:** `rules/page.tsx:44-56`

Backend'да upsert yo'qligi sababли frontendда himoya:

```ts
async function saveLimit() {
  if (!deviceId) return;
  const minutes = Number(limit);
  if (limit.trim() && (!Number.isFinite(minutes) || minutes < 0)) {
    toast.error("Limit musbat butun son bo'lishi kerak.");
    return;
  }
  const previous = rules;                       // rollback nuqtasi
  const old = rules.find((r) => r.rule_type === "daily_limit_minutes");
  setSaving(true);
  try {
    if (minutes > 0) {
      const created = await createRule(deviceId, "daily_limit_minutes", { minutes });
      if (old) await deleteRule(old.id).catch(() => {});   // yangisi turgach eskisini o'chirish
      setRules((r) => [...r.filter((x) => x.rule_type !== "daily_limit_minutes"), created]);
      toast.success(`Kunlik limit ${minutes} daqiqa qilib saqlandi.`);
    } else if (old) {
      await deleteRule(old.id);
      setRules((r) => r.filter((x) => x.rule_type !== "daily_limit_minutes"));
      toast.success("Kunlik limit o'chirildi.");
    }
  } catch (e) {
    setRules(previous);
    toast.error(e instanceof Error ? e.message : "Limit saqlanmadi");
  } finally { setSaving(false); }
}
```

Asosiy o'zgarish: **avval yaratish, keyin eskisini o'chirish** — xato bo'lса
qurilma limitsiz qolmaydi. Qo'shimcha: `saving` holati, validatsiya, muvaffaqiyat
toast'i (`addBlockedApp` ga ham).

> Agar backendда `PUT /api/rules/<device>/daily-limit/` qo'shилса — bu vaqtinchalik
> yechim o'rniga bitta chaqiruv bo'ladi. Alohida backend vazifasi sifatida qayd
> etilsin.

**Tekshirish:** limit saqlash → toast; tarmoqни uzib saqlash → eski qiymat qoladi,
xato toast'i; 0 kiritish → limit o'chadi.

**Commit:** `rules: make daily-limit saving non-destructive and confirm it`

---

## 2.4 — `not-found` / `error` / `loading`  `P1-9`

**Fayllar:** yangi `src/app/not-found.tsx`, `src/app/error.tsx`,
`src/app/global-error.tsx`

Uchalasi ham `auth-page`/`auth-card` uslubида (sidebar'siz, chunki noma'lum
holatда auth bor-yo'qligi aniq emas):

- **404** — "Sahifa topilmadi" + `/overview`ga tugma.
- **error.tsx** — `"use client"`, `reset()` bilan "Qayta urinish" tugmasi,
  xato matnи faqat `NODE_ENV !== "production"` да ko'rsatiladi.
- **global-error.tsx** — layout'ning o'zи yiqilса.

**Tekshirish:** `/xyz` → brendlangan 404. Komponent ичида ataylab `throw` →
brendlangan xato sahifаsi, "Qayta urinish" ishlaydi.

**Commit:** `app: branded not-found and error boundaries`

---

## 2.5 — Alerts pagination  `P1-8`

**Fayl:** `alerts/page.tsx`

Activity sahifаsидаgi naqsh takrorlanadi: `PAGE_SIZE = 10`, `page` state,
`slice()`, `← Oldingi · N/M · Keyingi →`. Backend `getAlerts` hozir hammasini
qaytaradi, shuning uchun **client-side** kesиш kifoya (alertlar soni yuzlab
bo'lса — backendда limit/offset qo'shish alohida vazifa).

Bir vaqtда: `markAllSeen` uchun `busy` holati va muvaffaqiyat toast'i.

**Commit:** `alerts: paginate the list at 10 rows`

---

## 2.6 — `focus-visible` uslublari  `P3-2`

**Fayl:** `globals.css`

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--brand-blue);
  outline-offset: 2px;
  border-radius: 8px;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

`:where()` — nolinchi specificity, mavjud uslublar bilan urishmaydi.

**Commit:** `a11y: visible focus ring and reduced-motion support`

---

# 3-BOSQICH — Muvofiqlik

---

## 3.1 — Signup sahifаsi + login havolasi  `P1-6`

**Fayllar:** `signup/page.tsx`, `login/page.tsx`

- Signup markup'ini `auth-page > auth-shell > auth-visual + auth-card` tuzilишига
  ko'chirish (login bilan bir xil chap panel).
- 16 ta inline style o'rniga mavjud `edit-field` / `btn-primary auth-submit`
  klasslari.
- Xatoni `toast` dan tashqари `.auth-error` blokида ham ko'rsatish (login kabi).
- `login/page.tsx` ga: `Hisobingiz yo'qmi? <Link href="/signup">Ro'yxatdan o'ting</Link>`
- Imlo: `"Kamyida"` → `"Kamida"`.

> **Qaror kerak:** signup ataylab yopiqmi (faqat Telegram orqали ro'yxatdan
> o'tish)? Agar shunday bo'lsa — havola qo'shilmaydi, o'rniga `/signup` dan
> `/login`ga redirect qilinadi. Bu mahsulot qarori, kod emas.

**Commit:** `signup: match the login auth shell; restore the link from login`

---

## 3.2 — Alerts sahifаsini dizayn tizimига keltirish  `P1-7`

**Fayl:** `alerts/page.tsx`

- `.glass` → `.card` + `.card-header` (sarlavha + "Barchasini ko'rilgan" tugmasi)
- `◌` / `!` → Iconify (`solar:forbidden-circle-linear`, `solar:danger-triangle-linear`)
- Inline `CSSProperties` obyektlari → `style.css` да `.alert-row`, `.alert-icon`
- Qurilma tanlagich qo'shish (bir nechta farzand bo'lса) — Activity sahifаsидаgи
  kabi `?device=` bilan
- `EmptyAlerts` — boshqa empty state'lar bilan bir xil ko'rinishда

**Commit:** `alerts: rebuild the page on the shared card/design system`

---

## 3.3 — O'lik boshqaruvlar  `P2-3`

| Element | Qaror |
|---|---|
| "Bugun" filter (`devices:467`) | **Olib tashlash** — qurilma jadvalида sana filtri mantiqsiz |
| Ro'yxat/katak toggle (`devices:472`) | **Olib tashlash** — katak ko'rinishi yo'q va rejalashtirилmagan |
| "Parolni tiklash" (`login:148`) | **Olib tashlash** — backendда endpoint yo'q. Qo'shилganда qaytariladi |
| Google login (`login:160`) | **Qoldirish**, lekin `disabled` + `title="Tez orada"` |
| "Profil (Tez orada)" tab (`rules:86`) | **Olib tashlash** — bitta tab qolса, tab bar ham keraksiz |
| "Hisobotlar" nav (`Sidebar:65`) | **Qoldirish** — allaqachon `opacity:.5` + "Tez orada", halol |

Tamoyil: *ishlaydiganга o'xshaган, lekin ishlamaydigan* element qolmasin.

**Commit:** `ui: remove non-functional controls, mark the deferred ones clearly`

---

## 3.4 — Ekran vaqti bar'i va batareya ikonкаsi  `P2-7`, `P2-8`

**Fayl:** `devices/page.tsx:511, 561`, `devices/[id]/page.tsx:189`

```ts
// bar: sutkaga emas, kunlik limitga (limit yo'q bo'lsa — jadvaldagi eng kattaga)
const scale = dailyLimit ?? Math.max(...Object.values(summaries).map(s => s?.total_screen_minutes ?? 0), 60);
const usagePercent = Math.min((minutesUsed / scale) * 100, 100);
```

```tsx
function BatteryIcon({ level }: { level: number | null }) {
  if (level === null) return <iconify-icon icon="solar:battery-charge-minimalistic-linear" />;
  const icon = level > 66 ? "solar:battery-full-linear"
             : level > 33 ? "solar:battery-half-linear"
             : "solar:battery-low-linear";
  const color = level > 20 ? "var(--muted)" : "var(--danger)";
  return <iconify-icon icon={icon} style={{ color }} />;
}
```

Bar limitдан oshса qizil rangга o'tsin.

**Commit:** `devices: scale the usage bar to the daily limit; battery icon by level`

---

## 3.5 — Download metadata avtomatlashtirish  `P2-9`

**Fayllar:** `scripts/windows/build-guard-setup.ps1`,
yangi `parent-web/src/app/download/release.json`, `download/page.tsx`

Build skripti oxirида `release.json` yozadi:

```json
{ "version": "0.4.0-rc.1", "file": "ChaqimchiAI-Guard-Setup.exe",
  "bytes": 23589642, "sha256": "9D57...", "date": "2026-08-28" }
```

`download/page.tsx` uni import qiladi va hajmни bayt'дан hisoblaydi. Qo'lда
yozилган qiymat qolmaydi → eskirishi mumkin emas.

Bir vaqtда: hozirgi `21.4 MB` → `22.5 MB` (haqiqiy).

**Commit:** `download: generate release metadata from the build script`

---

# 4-BOSQICH — Texnik qarz

> Bu bosqich foydalanuvchiга ko'rinmaydi, lekin keyingi har bir ishни
> arzonlashtiradi. Bir sprintда emas, fon rejimида bajarilса ham bo'ladi.

## 4.1 — `useApiQuery` hook'i  `P2-1`, `P1-4`

```ts
export function useApiQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  opts: { enabled?: boolean } = {},
) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: Error | null }>(
    { data: null, loading: opts.enabled !== false, error: null },
  );
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (opts.enabled === false) return;
    const ac = new AbortController();
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher(ac.signal)
      .then((data) => { if (alive) setState({ data, loading: false, error: null }); })
      .catch((e) => { if (alive && e.name !== "AbortError") setState((s) => ({ ...s, loading: false, error: e })); });
    return () => { alive = false; ac.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, opts.enabled]);
  return { ...state, refetch: () => setNonce((n) => n + 1) };
}
```

Migratsiya tartibи (eng oddiyдан murakkabга): `rules` → `alerts` → `devices` →
`overview` → `activity`. Har sahifа alohida commit.

Bu ~7 ta `useEffect`ни, `setTimeout(...,0)` hacklarини va `cancelled` bayroqlarини
yo'q qiladi.

## 4.2 — `<AuthGuard>`  `P2-2`

`AppShell` ичида: token yo'q bo'lса darhol `router.replace("/login")` va sahifани
umuman render qilmaslik (hozir bir lahza ko'rinадi). Har sahifадаgi
`if (!getAccessToken())` tekshiruvи olib tashlanadi.

## 4.3 — O'lik kodni o'chirish  `P2-4`

`components/BarChart.tsx`, `components/DonutChart.tsx`, `components/formStyles.ts`,
`hooks/useMounted.ts` — ~250 qator, hech qayerда import qilinmaydi.

## 4.4 — Devices/Children context  `P2-10`

`AppShell` darajasида bitta provider; `TopbarActions` va sahifаlar undan oladi.
`useApiQuery` bilan birga qilinса mantiqли.

## 4.5 — CSS'ni bo'lish  `P2-5`

7 936 qator → mantiqiy fayllar:

```
styles/tokens.css      — :root, dark tokenlar
styles/base.css        — reset, typography, body
styles/layout.css      — sidebar, content, topbar
styles/components.css  — card, button, badge, modal, table, form
styles/charts.css      — timeline, donut, bar
styles/pages/*.css     — sahifага xos qoldiqlar
styles/responsive.css  — media query'lar (hozir 5 joyга sochilган)
```

Bir vaqtда takroriy selektorlar birlashtiriladi (`.badge` 5 marta, `.sidebar` 12
marta e'lon qilинган). **Har fayl alohida commit**, har biriдан keyin vizual
tekshiruv.

## 4.6 — Inline style'larni klassга ko'chirish  `P2-6`

114 ta `style={{...}}` bloki. Avval eng ko'p takrorlanadiganlarи
(`activity` 42, `devices` 42, `rules` 30). Har render'да yangi obyekt yaratilishi
ham to'xtaydi.

## 4.7 — Test tooling  `P3-7`

Vitest + Testing Library. Birinchi navbatда **sof mantiq** (UI emas):

| Test | Fayl |
|---|---|
| `appDisplay()` — registry, prettify, fallback | `lib/appDisplay.test.ts` |
| `foldBlocks()` — session birlashtirish, ≤6 blok | `components/DayTimeline.test.ts` |
| `apiFetch` — cache, `noCache`, refresh dedup, timeout | `api/client.test.ts` |
| `useObjectUrl` — revoke chaqirilishi | `hooks/useObjectUrl.test.ts` |

Keyin: Playwright bilan bitta smoke oqim (login → overview → activity → devices).

## 4.8 — Media proxy stream  `P2-11`

```ts
return new NextResponse(response.body, {  // arrayBuffer() emas
  status: 200,
  headers: {
    "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
    "Cache-Control": "public, max-age=3600",
  },
});
```

## 4.9 — Qolgan mayda ishlar  `P3-1`, `P3-3`…`P3-6`, `P3-8`

- `layout.tsx` ga `viewport` + `themeColor` metadata
- `WheelPicker` ARIA ierarxiyasini to'g'rilash (listbox fokus + `↑`/`↓`)
- `Header.tsx` sarlavhalарини route → matn xaritasига
- Imlo tuzatishlari (`Kamyida`, `yuzichadan`)
- "Web-saytlar" tabini `disabled` + "Tez orada" ko'rinишига

---

# 5. Commit / branch strategiyasi

| Bosqich | Branch | Commit soni | Baho |
|---|---|---|---|
| 1 | `fix/p0-blockers` | ~7 | 1–2 kun |
| 2 | `fix/p1-stability-a11y` | ~6 | 1–2 kun |
| 3 | `fix/p2-consistency` | ~5 | 1 kun |
| 4 | `chore/tech-debt` (bo'lakma-bo'lak) | ~15 | fon ishи |

Har bosqich `main`ga merge qilinganda Vercel avtomat deploy qiladi. 1- va 2-
bosqichdan keyin real qurilmада (dark rejim + klaviatura) qo'lда tekshirish shart.

---

# 6. Regressiya ro'yxati (har bosqichdan keyin)

Light **va** dark rejimда, desktop 16:9 **va** mobil kenglikда:

- [ ] `/login` — kirish, xato holati, Telegram tugmasi
- [ ] `/overview` — 4 ta stat karta, donut hover/tooltip, 7 kunlik grafik, qoidalar
- [ ] `/activity` → **Ekran vaqti** — ustunga bosish kunni tanlaydi, 3 karta yangilanadi
- [ ] `/activity` → **Ilovalar** — ikonкалар, 10 tadan pagination
- [ ] `/activity` → **Faoliyat tarixi** — timeline scrub cursor, tooltip, kun navigatsiyasi, 10 tadan pagination
- [ ] `/devices` — jadval, farzand qo'shish modal'i, qurilma bog'lash 3 qadam, profil tahrirlash
- [ ] `/devices/[id]` — statlar, ilovalar, uzish tasdig'i
- [ ] `/rules` — limit saqlash, ilova qo'shish/o'chirish
- [ ] `/alerts` — ro'yxat, "barchasini ko'rilgan", pagination
- [ ] `/download` — hajm/SHA to'g'ri, yuklab olish ishlaydi
- [ ] `/xyz` — brendlangan 404
- [ ] Faqat klaviatura bilan: login → farzand qo'shish → qurilma bog'lash
- [ ] Tema toggle → F5 → saqlanadi, lipillash yo'q
- [ ] `npx tsc --noEmit && npx eslint src && npx next build` — toza

---

# 7. Ataylab qilinmaydigan ishlar

Aniqlik uchun — bular ko'rib chiqилди va **hozircha kerak emas** deb topildi:

- **Tailwind / CSS-in-JS ga to'liq ko'chish** — 7 900 qator CSS'ni qayta yozish
  regressiya xavfи juda katta. §4.5 dagi bosqichli bo'lish yetarli.
- **State menejeri (Redux/Zustand)** — ma'lumot server holati, client holati emas.
  `useApiQuery` yoki TanStack Query to'g'ri javob.
- **i18n karkasi** — mahsulot faqat o'zbek tilида, bitta til uchun ortiqcha qatlam.
- **Storybook** — 10 ta komponent uchun xarajat foydадан ko'p.
- **SSR / server component'larга ko'chirish** — dashboard to'liq authenticated va
  interaktiv; hozirgi client-side model to'g'ri.
