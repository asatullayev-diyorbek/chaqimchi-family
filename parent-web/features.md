# parent-web — audit va tuzatish rejasi

**Sana:** 2026-08-30
**Ko'lam:** `parent-web/` (Next.js 16 / React 19, 13 route, ~12 900 qator)
**Juftlik hujjat:** `fix-plan.md` — qanday tuzatiladi (bajarish rejasi).
**Uslub:** frontend developer + QA tester + UI/UX ko'rigi. Har bir band tekshirilgan
(fayl:qator ko'rsatilgan), taxmin emas.

Bu hujjat **reja**, bajarilgan ish emas. Har bir band bajarilganda `[x]` qilинadi.

---

## 0. Umumiy xulosa

Loyiha ishlaydi va real backend ma'lumoti bilan to'g'ri ishlaydi — mock data yo'q,
build/lint/typecheck toza. Asosiy muammolar **funksionallikда emas, sifat qatlamida**:
dark rejim yarim ishlaydi, modal/dropdown'larда klaviatura va a11y yo'q, holat
boshqaruvida bir nechta real bug bor, va CSS 7 900 qatorlik yagona faylда.

| Daraja | Soni | Mazmuni |
|---|---|---|
| **P0 — blocker** | 4 | Foydalanuvchi oqimini buzadi yoki xato ma'lumot ko'rsatadi |
| **P1 — yuqori** | 9 | A11y, holat/xotira buglari, jiddiy UX bo'shliqlari |
| **P2 — o'rta** | 11 | Nomuvofiqlik, o'lik UI, texnik qarz |
| **P3 — past** | 8 | Sayqal, matn, kelajak uchun |

**Tavsiya:** P0 → P1 ni bir sprintда yopish. P2 keyingi sprint. P3 fon ishi.

**Bajarilish holati (2026-08-30):** 1- va 2-bosqich yakunlandi.
Yopilgan: **P0-1…P0-4**, **P1-1, P1-2, P1-3, P1-5, P1-8, P1-9**, **P3-1, P3-2, P3-3**.
Hammasi productionга deploy qilindi. Batafsil: `fix-plan.md` §1–2.
3-bosqich: **P1-6, P1-7, P2-3, P2-7, P2-8, P2-9**.
4-bosqichdan: **P2-2** (AuthGuard endi `(dashboard)/layout.tsx` da), **P2-4**
(o'lik kod), **P2-10** (qobiq bir marta mount bo'ladi, har navigatsiyada
qayta so'rov yo'q), **P2-11** (media proxy stream).

Reja tashqarisida qo'shimcha qilinganlar: sidebar animatsiyasi har menyu
bosilganda qayta o'ynashi (ildizi — `AppShell` sahifa ichida edi), 38 ta
`transition: all`, dark rejim uchun qolgan literal ranglar, yo'q
`.add-device-btn.secondary` qoidasi, `.child-pick-item.active`/`.selected`
nomlar mos kelmasligi.

**Qolgan (faqat texnik qarz):** P1-4 + P2-1 (query qatlami), P2-5 (CSS bo'lish),
P2-6 (inline style), P3-7 (testlar).

---

## 1. P0 — Blockerlar

### [x] P0-1. Telegram login GET-cache tufayli 60 soniya osilib qoladi

**Fayl:** `src/api/client.ts:73` + `src/api/auth.ts:57` + `src/app/login/page.tsx:71`

`apiFetch` barcha GET javoblarini 60 soniya cache'laydi (`GET_CACHE_TTL_MS = 60_000`).
`telegramStatus()` — GET. Login sahifasi uni **har 800 ms** so'raydi. Birinchi javob
(`{"status":"pending"}`) cache'ga tushadi va keyingi ~75 ta so'rov **o'sha eski
"pending"ni** qaytaradi. Natijada foydalanuvchi Telegramда tasdiqlaydi, lekin
sahifa 60 soniyagacha hech nima qilmaydi.

> Bu regressiya men TTL'ni 15s → 60s qilganда kuchaygan; 15s'да ham mavjud edi.

**Yechim:** `ApiFetchOptions`ga `noCache?: boolean` qo'shish va polling
chaqiruvlarida yoqish. Muqobil: cache'ni faqat `Authorization` bor GET'larга
qo'llash (polling `skipAuth: true`).

**Tekshirish:** Telegram login → tasdiqlash → 1-2 soniyaда `/overview`ga o'tishi.

---

### [x] P0-2. Dark rejim dizayn tokenlarini almashtirmaydi

**Fayl:** `src/app/globals.css:1-52` (tokenlar), `src/app/style.css:3998+` (dark blok)

`[data-theme="dark"]` blokida **birorta ham** `--surface`, `--foreground`, `--muted`,
`--border`, `--background` qayta e'lon qilinmagan — tekshirildi, natija bo'sh.
Dark rejim ~137 ta alohida selektorni qo'lда qayta bo'yaydi.

Ammo TSX ichида **92 ta joyда** `var(--surface)` / `var(--foreground)` /
`var(--border)` / `var(--muted)` inline ishlatilган. Ular dark rejimда ham
**oq fon / qora matn** bo'lib qoladi → qora sahifada oq karta, o'qib bo'lmaydigan
matn.

Qo'shimcha: yangi chart komponentlari qattiq hex bilan yozilgan —
`DayTimeline` (`#1f2b3a #2563eb #9aa6b6 #e6edfc …`), `ScreenTimeChart`
(`#1f2b3a #7a8698 #a9c9fb …`), `CategoryDonut` (`#1f2b3a #93b4ff`).

**Yechim (bir martalik, katta samara):**
1. `globals.css`da `:root[data-theme="dark"]` blokiда **barcha tokenlarni** qayta
   e'lon qilish (`--surface: #1b2534`, `--foreground: #e8edf5`, `--muted: #94a3b8`,
   `--border: #2b3648`, `--background: #111827`, glass tokenlar va h.k.).
2. Chart komponentlaridagi hex'larni tokenga o'tkazish (`--chart-axis`,
   `--chart-grid`, `--chart-bar`, `--chart-bar-active` kabi yangi tokenlar).
3. Shundan keyin `style.css`dagi 137 ta qo'lда yozilган dark override'ning
   ko'pchiligини o'chirish mumkin bo'ladi (alohida P2 ish).

**Tekshirish:** Har 8 sahifaда dark toggle → hech qayerда oq-oqда yoki qora-qorада
matn qolmasligi. Kontrast ≥ 4.5:1.

---

### [x] P0-3. Dark rejim saqlanmaydi

**Fayl:** `src/components/layout/TopbarActions.tsx:44-61, 79-82`

Tema faqat `document.documentElement`ga yoziladi. `localStorage` yo'q,
`layout.tsx:19`да esa qattiq `data-theme="light"` turadi. Har sahifa
yangilanишида yoki qayta ochилганда dark rejim yo'qoladi.

**Yechim:** temani `localStorage`ga yozish + `layout.tsx`ning `<head>`ига kichik
blocking skript (FOUC oldini olish uchun) yoki `prefers-color-scheme` ni
boshlang'ich qiymat sifatida o'qish.

---

### [x] P0-4. Modal'lar klaviatura va skrinrider uchun yopiq

**Fayl:** `TopbarActions.tsx:212`, `devices/page.tsx:214, 395`

Uchala modal (`Farzand qo'shish`, `Qurilma bog'lash`, `Farzand profili`):
- `Escape` bilan yopilmaydi
- focus trap yo'q — Tab modal ortidagi sahifaga o'tib ketadi
- `role="dialog"` / `aria-modal="true"` / `aria-labelledby` yo'q
- ochilganда `<body>` scroll bloklanmaydi
- yopilганда focus qaytmaydi

Bu WCAG 2.1 buzilishi va klaviatura foydalanuvchisi uchun tuzoq.

**Yechim:** bitta `<Modal>` komponenti yaratib (focus trap + Escape + scroll lock +
ARIA + overlay click), uchala joyда ishlatish. ~80 qator, uch joyдаги
takrorlanишни ham yo'q qiladi.

---

## 2. P1 — Yuqori

### [x] P1-1. `URL.createObjectURL` xotira sizishi

**Fayl:** `TopbarActions.tsx:245`, `devices/page.tsx:410`

Render ichида chaqirilган — har render'да yangi blob URL yaratiladi va hech qachon
`revokeObjectURL` qilinmaydi. Rasm tanlab, modal'ni bir necha marta ochib-yopish
brauzer xotirasида blob'lar to'playdi.

**Yechim:** `useEffect` + `useState` bilan bitta URL yaratib, cleanup'да
`URL.revokeObjectURL`.

### [x] P1-2. `confirm()` — brauzer dialogи

**Fayl:** `devices/page.tsx:123`, `devices/[id]/page.tsx:104`

Farzandni o'chirish va qurilmani uzish — ikkalasi ham native `confirm()`.
Dizayn tizimidan tashqarida, uslublanmaydi, mobil'да xunuk.

**Yechim:** P0-4 dagi `<Modal>` asosида `<ConfirmDialog>`.

### [x] P1-3. Dropdown'lar klaviaturasiz

**Fayl:** `TopbarActions.tsx:138-208`

- `child-profile` — `role="button" tabIndex={0}` bor, lekin `onKeyDown` yo'q
  (Enter/Space ishlamaydi)
- `Escape` bilan yopilmaydi
- ro'yxat elementlari `<a href="#">` — o'zi link emas, `<button>` bo'lishi kerak
- `aria-expanded` / `aria-haspopup` yo'q
- tashqariga bosish faqat `mousedown` — touch qurilmада ishlamaydi

### [x] P1-4. `setTimeout(..., 0)` bilan lint qoidasini aylanib o'tish

**Fayl:** `devices/page.tsx:82-90`, `telegram/complete/page.tsx:25-36`,
`activity/page.tsx:93, 133, 158`

`react-hooks/set-state-in-effect` qoidasini chetlab o'tish uchun state
o'rnатish 0 ms timeout'ga o'ralган. Bu allaqachon bitta real bug bergan
(«yuklanmoqda» dеб qotib qolish — `5070856`). Qolgan joylarда ham xuddi shu
xavf bor.

**Yechim:** to'g'ri patternga o'tish — boshlang'ich state'ni to'g'ri berish,
`useSyncExternalStore` yoki data-fetch qatlami (P2-1).

### [x] P1-5. Rules sahifasida limit saqlash atomik emas

**Fayl:** `rules/page.tsx:44-56`

`saveLimit()` avval eski qoidани **o'chiradi**, keyin yangisini yaratadi. Agar
`createRule` xato bersa — limit umuman yo'qoladi va foydalanuvchiga faqat toast
chiqadi. Qurilma esa limitsiz qoladi.

Qo'shimcha: muvaffaqiyatли saqlangan holда **hech qanday tasdiq yo'q** (toast ham
yo'q) — foydalanuvchi saqlanganини bilmaydi.

**Yechim:** backendда PUT/upsert endpoint, yoki xato bo'lganда eski qiymatni
tiklash + muvaffaqiyat toast'i.

### [x] P1-6. Signup sahifasi loyiha dizaynidan tashqarида

**Fayl:** `signup/page.tsx:33-47`

Login sahifasi — ikki panelli, brendlangan `auth-shell` (hero rasm, benefit'lar).
Signup — oddiy markazlashган oq karta, 16 ta inline style. Bir mahsulotning ikki
sahifasi ikki xil mahsulotга o'xshaydi.

Bundan tashqari: **login'да signup'ga havola yo'q** (`aea4253` commit'да
olib tashlangan) — ro'yxatdan o'tish UI orqali umuman erishib bo'lmaydi.

**Yechim:** signup'ni `auth-shell` ichига ko'chirish; login'га "Hisobingiz yo'qmi?"
havolasini qaytarish (yoki signup'ni ataylab yopiq deb hujjatlashtirish).

### [x] P1-7. Alerts sahifasi dizayn tizimidan tashqарида

**Fayl:** `alerts/page.tsx:81-110`

- `.glass` ishlatadi, boshqa hamma joyда `.card`
- ikonкалар — `◌` va `!` matn belgilari, boshqa joyда Iconify
- barcha uslublar inline `React.CSSProperties` obyektlarида
- sarlavha yo'q (faqat o'ngда bitta tugma)
- qurilma tanlagich yo'q — jimgina birinchi linked qurilmani oladi

### [x] P1-8. Ro'yxatlarда pagination yo'q

**Fayl:** `alerts/page.tsx:85`, `devices/page.tsx:495`

Activity sahifasида 10 tadan pagination qilинdi, lekin **Alerts** (`alerts.map`
— hammasi) va **Qurilmalar jadvalида** yo'q. Ogohlantirishlар vaqt o'tиши bilan
yuzlab bo'ladi.

### [x] P1-9. `not-found` / `error` / `loading` sahifalari yo'q

**Fayl:** `src/app/` — `not-found.tsx`, `error.tsx`, `loading.tsx` mavjud emas

Noto'g'ri URL → Next.js'ning standart oq 404 sahifasi, brendsiz, sidebar'siz.
Runtime xato → oq ekran. Route almashganда — hech qanday indikator yo'q.

---

## 3. P2 — O'rta

### [x] P2-1. Data-fetch qatlami yo'q — har sahifa qo'lда `useEffect`

Har sahifада bir xil naqsh takrorlanadi: `useEffect` + `getAccessToken()` tekshiruvи
+ `router.replace("/login")` + fetch + `cancelled` bayrog'i + `try/catch` + toast.
6 sahifаda ~7 marta.

**Yechim:** `useApiQuery(fn, deps)` hook'i (loading / error / retry / cancel bir
joyда) yoki SWR / TanStack Query. Bu P1-4 ni ham yopadi.

### [x] P2-2. Auth guard'i sahifаda emas, layoutда bo'lishi kerak

Har sahifа o'zi `getAccessToken()` tekshiradi. Token yo'q bo'lsa sahifа bir lahza
**ko'rinадi**, keyin redirect bo'ladi (flash). Markazlashган `<AuthGuard>`
`AppShell` ichида bo'lishi kerak.

### [x] P2-3. O'lik UI boshqaruvlari

| Element | Fayl | Holat |
|---|---|---|
| "Bugun" filter tugmasi | `devices/page.tsx:467` | `onClick` yo'q |
| Ro'yxat/katak ko'rinish toggle | `devices/page.tsx:472` | `onClick` yo'q |
| "Parolni tiklash" | `login/page.tsx:148` | `<span>`, link emas |
| Google login | `login/page.tsx:57` | "tez orada" toast |
| "Profil (Tez orada)" tab | `rules/page.tsx:86` | `href="#"` |
| "Hisobotlar" nav | `Sidebar.tsx:65` | `href` yo'q, `opacity:.5` |

**Yechim:** ishlamaydiganini olib tashlash yoki aniq "tez orada" belgisi qo'yish.
Hozir bir qismi ishlaydiganга o'xshaydi — bu foydalanuvchini aldaydi.

### [x] P2-4. O'lik kod — 4 ta ishlatilmaydigan fayl

`components/BarChart.tsx` (107), `components/DonutChart.tsx` (82),
`components/formStyles.ts`, `hooks/useMounted.ts` — hech qayerда import qilinmaydi.
~250 qator. O'chirish kerak.

### [ ] P2-5. `style.css` — 7 936 qator, bitta fayl

Loyihaнинг 61% CSS'i bitta faylда. `.badge` 5 marta, `.sidebar` 12 marta qayta
e'lon qilинган — kaskад bo'yicha oxirgisi yutadi, qaysи biri amal qilayotganини
aniqlash qiyin. Yangi o'zgarish har safar regressiya xavfини tug'diradi.

**Yechim:** modullarга bo'lish (`base.css`, `layout.css`, `components/*.css`,
`pages/*.css`) yoki CSS Modules / Tailwind'ga bosqichma-bosqich ko'chish.
Kamida: takroriy selektorlarni birlashtirish.

### [ ] P2-6. Inline style'lar juda ko'p

`activity/page.tsx` — 42 ta, `devices/page.tsx` — 42 ta, `rules/page.tsx` — 30 ta
`style={{...}}` blokи. Har render'да yangi obyekt (React uchun har safar yangi
prop), dark rejim bilan mos emas (P0-2), qayta ishlatilmaydi.

### [x] P2-7. Qurilma jadvalидаgi "ekran vaqti" bar'i yanglish

**Fayl:** `devices/page.tsx:511`

`usagePercent = minutes / (24 * 60)` — sutkaнинг 24 soatига nisbatan. 4 soatlik
faoliyat 17% ko'rsatadi, ya'ni bar deyarli doim bo'sh. Kunlik **limitga** nisbatan
bo'lishi kerak (limit yo'q bo'lsa — eng katta qiymatga).

### [x] P2-8. Batareya ikonкаси qiymatга bog'liq emas

**Fayl:** `devices/page.tsx:561`, `devices/[id]/page.tsx:189`

92% ham, 8% ham `solar:battery-low-linear`. Darajaga qarab ikonка va rang
o'zgarishi kerak (past bo'lsa qizil).

### [x] P2-9. `/download` sahifасидаgi hajm eskirган

**Fayl:** `download/page.tsx:14`

Sahifада `21.4 MB`, haqiqiy fayl **22.5 MB** (23 589 642 bayt).
SHA-256 to'g'ri (tekshirildi) — faqat hajm eski.
Build skripti bu qiymatlarni avtomatik yozishi kerak, qo'lда emas.

### [x] P2-10. `TopbarActions` har sahifада ortiqcha so'rov qiladi

**Fayl:** `TopbarActions.tsx:56-57`

`AppShell → Header → TopbarActions` har sahifада `getDevices()` + `getChildren()`
chaqiradi, sahifаning o'zи ham xuddi shu ma'lumotni oladi. GET-cache tufayли
tarmoqда takrorlanmaydi, lekin ikki manbада ikki nusxa holat bor va ular
farqlanishi mumkin.

**Yechim:** `DevicesContext` / `ChildrenContext` (yoki P2-1 dagi query qatlami).

### [x] P2-11. Media proxy butun faylni xotiraга yuklaydi

**Fayl:** `media/[...path]/route.ts:10`

`await response.arrayBuffer()` — katta rasm butunlay RAM'ga. `response.body`ni
to'g'ridan-to'g'ri stream qilish kerak. Yana: `fetch`да `cache: "no-store"`,
javobда esa `max-age=3600` — ziddiyat.

---

## 4. P3 — Past / sayqal

- [x] **P3-1.** `layout.tsx`да `viewport` va `themeColor` metadata yo'q; PWA manifest yo'q.
- [x] **P3-2.** `focus-visible` uslublari deyarli yo'q (butun CSS'да 6 ta hit) —
  klaviatura bilan yurgan foydalanuvchi qayerдалиgини ko'rmaydi.
- [x] **P3-3.** `prefers-reduced-motion` hisobga olinmaган.
- [x] **P3-4.** Imlo: `"Kamyida 8 ta belgi"` → `"Kamida"` (`signup/page.tsx:80`);
  `"yuzichadan"` → `"yuqoridagi menyudan"` (`devices/page.tsx:256`).
- [ ] **P3-5.** `WheelPicker` ARIA ierarxiyasi noto'g'ri — `role="listbox"` va
  `role="option"` orasida `.wheel-picker-scroll` div turibdi; listbox fokus
  olmaydi, strelka tugmalari ishlamaydi.
- [ ] **P3-6.** `Header.tsx:19-70` — sahifа sarlavhalари 7 ta `if` bilan qattiq
  yozilган. Route → sarlavha xaritasига (yoki route metadata'ga) chiqarish.
- [x] **P3-7.** Test tooling umuman yo'q (vitest / RTL / Playwright). Kamida
  `appDisplay()`, `foldBlocks()`, `apiFetch` cache/refresh mantiqи uchun unit test.
- [ ] **P3-8.** Web-saytlar tabi bo'sh (`browser_domain` agentда yo'q) — halol
  yozилган, lekin tab'ni yashirish yoki "tez orada" ko'rinишига o'tkazish afzal.

---

## 5. Bosqichma-bosqich reja

### 1-bosqich — Blockerlar (1 sprint)
1. P0-1 Telegram cache (kichik, darhol)
2. P0-2 dark tokenlar + chart ranglari
3. P0-3 tema saqlash
4. P0-4 `<Modal>` komponenti → uchala modal
5. P1-2 `<ConfirmDialog>` (P0-4 ustiga)

**Natija:** dark rejim to'liq ishlaydi, Telegram login tez, modal'lar a11y-ga mos.

### 2-bosqich — Barqarorlik va a11y
6. P1-1 blob URL cleanup
7. P1-3 dropdown klaviatura + ARIA
8. P1-5 limit saqlash atomikligi + tasdiq
9. P1-9 `not-found` / `error` / `loading`
10. P1-8 Alerts pagination
11. P3-2 `focus-visible`

### 3-bosqich — Muvofiqlik
12. P1-6 signup dizayni + login havolasi
13. P1-7 alerts sahifаsini `.card` tizimига keltirish
14. P2-3 o'lik boshqaruvlar
15. P2-7 / P2-8 ekran vaqti bar'i, batareya ikonкаsi
16. P2-9 download metadata avtomatlashtirish

### 4-bosqich — Texnik qarz
17. P2-1 `useApiQuery` / query qatlami → P1-4 ni ham yopadi
18. P2-2 `<AuthGuard>` `AppShell`да
19. P2-4 o'lik kodni o'chirish
20. P2-10 devices/children context
21. P2-5 CSS'ni modullarга bo'lish
22. P2-6 inline style'larni klasslarга ko'chirish
23. P3-7 test tooling

---

## 6. Qabul mezonlari

- [ ] 8 sahifаning har birida dark toggle → o'qib bo'lmaydigan matn yo'q, kontrast ≥ 4.5:1
- [ ] Tema sahifа yangilanганда saqlanadi
- [ ] Telegram login tasdiqdan keyin ≤ 3 soniyада o'tadi
- [ ] Har modal: `Escape` yopadi, `Tab` ichида qoladi, yopilганда focus qaytadi
- [ ] Faqat klaviatura bilan: login → farzand qo'shish → qurilma bog'lash → uzish
      oqimи oxirigача bajarилadi
- [ ] Barcha ro'yxatlarда 10 tadan pagination
- [ ] Noto'g'ri URL → brendlangan 404; runtime xato → brendlangan error sahifаsi
- [ ] `npx tsc --noEmit`, `npx eslint src`, `npx next build` — 0 xato, 0 warning
- [ ] Ishlamaydigan tugma/havola qolmaган (yoki aniq "tez orada" deb belgilanган)
- [ ] Lighthouse (desktop): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95

---

## 7. Hozirda yaxshi bo'lган narsalar (buzmaslik kerak)

- **Mock data umuman yo'q** — har bir qiymat backend API'дан. Alohida tekshirildi.
- `api/client.ts` — refresh dedup, proaktiv token yangilash, 25s timeout,
  GET uchun bir marta qayta urinish, in-flight dedup. Yaxshi o'ylanган qatlam.
- `lib/appDisplay.ts` — exe → nom/kategoriya registri + `prettify()` fallback,
  toza va kengaytiriladigan.
- `AppIcon` — 3 bosqichli fallback (agent .ico → brend → kategoriya).
- Timeline session aggregation (backend 5-daq gap + frontend ≤6 blok) — chinakam
  o'ylanган UX qarori.
- Uzbek tilидаgi matn izchil, "hali mavjud emas" holatlari halol yozилган.
- `build` 13 route uchun ~0.8s — tez.
