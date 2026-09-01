# Agent + Installer UI — WebView2 ko'chirish rejasi

Sana: 2026-09-01
Maqsad: agent va installer oynalarini WebView2'ga o'tkazib, `agent/webui/` dagi
tayyor HTML/CSS dizaynni 1:1 render qilish. walk (native Win32) bilan yumaloq
burchak, soya, gradient, rangli tugma — printsipial mumkin emas.

## Holat

- **A bosqich — DONE** (`GOOS=windows` build+vet PASS; Windows'da real render ko'rilmagan):
  - `github.com/jchv/go-webview2` (pure Go) qo'shildi.
  - `child-ui/` → **`agent/webui/`** ko'chirildi (yagona manba, embed qilinadi).
  - `agent/webui/assets/`: `bridge.js` (Go↔JS: `ui.action()`, `__setState`,
    `data-bind`), `icons.js` (19 solar ikonka inline, CDN yo'q), `fonts.css` +
    `inter-latin/latinext.woff2` (offline Inter), `app.css` (oyna konteksti).
  - `agent/webui/embed.go` — `//go:embed`.
  - `agent/internal/ui/webwin/` — loopback fayl server (`127.0.0.1:0`) +
    `Window` (New/OnAction/SetState/Eval/Close/Run), `ShowWelcome()`.
  - `welcome.html` app-ready (Guard/ota-ona ohangi). `cmd/installer` uni
    ishlatadi; xato bo'lsa walk `ui.ShowWelcome()` ga qaytadi.
  - `cmd/uitest -screen webwelcome`.
- **B bosqich — DONE** (`GOOS=windows` build+vet PASS; Windows'da real render ko'rilmagan):
  - `consent.html`, `existing.html` (yangi), `connect.html`, `installing.html`,
    `complete.html`, `error.html` (yangi) — barchasi app-ready, Guard ohangida.
  - `bridge.js` kengaytirildi: `data-bind-src`, `data-bind-class`, va sahifa
    yuklanganda avtomatik `ui.action('__ready')` (Go boshlang'ich holatni shu
    voqeadan keyin yuboradi — timing race yo'q).
  - `webwin/installer.go`: `ShowConsent`, `ShowExisting`, `ShowComplete`,
    `ShowError`, `ShowEnroll`. `ShowEnroll` bitta oynada ishlaydi: `connect.html`
    (QR/kod/sanoq, JS-side countdown) → link topilgach `installing.html`ga
    `window.location.href` bilan o'tadi → `Install` callback'idan step/pct
    push qiladi (`__ready` orqali "catch-up" — sahifa qayta yuklansa oxirgi
    holat qayta yuboriladi). `ErrCodeExpired` / `context.Canceled` / real xato
    farqlanadi.
  - `cmd/installer/main.go`: har bosqich avval WebView2, `webwin.ErrUnavailable`
    bo'lsa walk'ga qaytadi (`showWelcome/showConsent/showExisting/showComplete`,
    `runEnroll`). QR endi Go tomonda `go-qrcode` bilan PNG→base64 generatsiya
    qilinadi (avval walk ichida edi).
  - `cmd/uitest -screen web{welcome,consent,connect,existing,complete,error}`.
- **C bosqich — DONE** (`GOOS=windows` build+vet PASS; Windows'da real render ko'rilmagan):
  - Yangi sahifalar: `adult-gate.html`, `adult-panel.html`, `info.html`.
  - `status.html`/`privacy.html` app-ready (Child ohangi, o'zgarishsiz mazmun).
  - `webwin/tray.go`: `ShowChildStatus`, `ShowPrivacy`, `ShowAdultAccessGate`,
    `ShowAdultPanel`, `ShowInfo`. Tray oynalari alohida goroutine'larda
    ochilgani uchun har biri `runtime.LockOSThread()` bilan o'z OS thread'iga
    biriktiriladi (Win32 xabar navbati thread-affine); `trayMu` bilan bir
    vaqtda faqat bitta tray oyna ochiq bo'ladi.
  - `internal/ui.Tray` ga `OnStatus/OnPrivacy/OnLogs` callback maydonlari
    qo'shildi (`OnAdultPanel` kabi) — `internal/ui` `webwin`ni import qila
    olmaydi (`webwin` allaqachon `ui`ni import qiladi, `ExistingChoice` uchun),
    shuning uchun webview-birinchi/walk-zaxira tanlovi `cmd/desktop`da.
  - `cmd/desktop`: barcha 4 callback webview-birinchi + walk fallback.
- **Qaror o'zgardi: walk kod o'chirilmaydi.** Dastlabki rejada "C dan keyin
  walk oynalar o'chiriladi" deyilgan edi, lekin amalda har bir WebView2 oyna
  `webwin.ErrUnavailable` bo'lsa walk'ga qaytadi (runtime yo'q/singan holatlar
  uchun tarmoqsiz backstop). Walk kod **doimiy zaxira** sifatida qoladi;
  E bosqichda WebView2 runtime bootstrapper Windows'da ishonchli tasdiqlansa,
  bu qarorni qayta ko'rib chiqish mumkin.
- **D-E bosqichlar** — quyida.

---

## 1. Umumiy infratuzilma (bir marta quriladi)

### 1.1. Kutubxona
- `github.com/jchv/go-webview2` — pure Go (cgo yo'q), WebView2 COM API wrapper.
  `WebView2Loader.dll` ni o'zi embed qiladi.
- Faqat `//go:build windows`.

### 1.2. HTML manbasi
- **`agent/webui/` "haqiqiy UI" ga aylanadi** (mockup emas). Har sahifa app-ready
  bo'ladi: CDN yo'q, offline ishlaydi, Go bilan ko'prik.
- Agent binary ichiga `//go:embed` bilan kiritiladi (`agent/internal/ui/web/`
  ga symlink/copy yoki `embed.FS` to'g'ridan `../../child-ui`).

### 1.3. Offline qilish
- **Shrift (Inter):** `@import url(fonts.googleapis…)` → `agent/webui/assets/inter/*.woff2`
  + lokal `@font-face`. 4 vazn ≈ 60 KB.
- **Ikonkalar:** `<iconify-icon icon="solar:*">` (CDN) → inline `<svg>`. Sahifalarda
  ~16 xil `solar:*` ikonka ishlatilgan; ularni bir marta yuklab, `agent/webui/assets/icons.js`
  (yoki to'g'ridan inline) ga qotiramiz. ≈ 16 KB.

### 1.4. Yetkazish
- Kichik ichki HTTP server: `http.Server` + `embed.FS`, `127.0.0.1:<random-port>`.
  Nisbiy `style.css`, `assets/*` shu orqali ishlaydi. Faqat loopback.
- Har oyna shu URL'ga `Navigate` qiladi: `http://127.0.0.1:PORT/welcome.html`.

### 1.5. Go ↔ JS ko'prik (shared helper: `internal/ui/webwin`)
```
type Window struct { w webview2.WebView; ... }
func Open(page string, opts Opts) *Window     // oyna yaratadi, page yuklaydi
(w *Window) Bind(name string, fn any)         // JS'dan chaqiriladigan Go funksiya
(w *Window) SetState(v any)                    // Go → JS: window.__setState(json)
(w *Window) Close()
(w *Window) Run()                              // modal: yopilguncha bloklaydi
```
- Har HTML sahifada kichik `bridge.js`: `window.__setState` ni ushlaydi,
  tugma `onclick` larni `window.go.<action>()` ga ulaydi.
- Sahifalar minimal o'zgaradi: `<a href="next.html">` → `<button onclick="go.next()">`,
  dinamik joylar `data-bind="today_minutes"` bilan belgilanadi.

### 1.6. Oyna o'lchamlari
| Tur | O'lcham | Sabab |
|---|---|---|
| Installer sahifalari (2 ustunli `install-layout`) | ~960 × 620 | chap "art" panel ko'rinadi, zamonaviy installer hissi |
| Tray status / privacy | ~400 × 560 | kichik, tray yonida |
| Adult panel | ~520 × 560 | forma |
| Block ekranlar | fullscreen | overlay |

### 1.7. WebView2 runtime bog'liqligi
- Win11: doim bor. Win10: odatda bor.
- Inno `[Files]` ga `MicrosoftEdgeWebview2Setup.exe` (Evergreen Bootstrapper, ~2 MB).
- `[Code] PrepareToInstall` yoki `[Run]`: runtime GUID registry'da yo'q bo'lsa
  bootstrapper'ni `/silent /install` bilan ishga tushirish.
- Registry tekshiruvi: `HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}` → `pv` bo'sh emasmi.

---

## 2. Kerakli oynalar — har biri uchun spetsifikatsiya

### Installer oqimi (`cmd/installer`, bir martalik, ota-ona ishlatadi)

| # | Oyna | HTML manbasi | Kirish (Go→JS) | Chiqish (JS→Go) | Jonli yangilanish |
|---|------|--------------|----------------|-----------------|-------------------|
| 1 | **Xush kelibsiz** | `welcome.html` (bor) | — | `next()`, `cancel()` | — |
| 2 | **Rozilik** | `consent.html` (bor) | — | `back()`, `accept()` (checkbox belgilanmasa `accept` o'chirilgan), `cancel()` | checkbox holati JS ichida |
| 3 | **Oilaga bog'lash** | `connect.html` (bor) | `code`, `qr_png_b64`, `expires_at` | `back()`, `cancel()` | har soniya sanoq; `conn_error` (internet yo'q); `linked` → 4-oynaga; kod tugasa yangi kod → `setState` |
| 4 | **O'rnatilmoqda** | `installing.html` (bor) | boshlang'ich step holati | — (tugmasiz) | `onLinked` callback'idan step yangilanadi: Fayllar→Bog'landi→Xizmat→Yakun; `%` progress |
| 5 | **Tayyor** | `complete.html` (bor) | — | `close()`, `view_status()` (bola oynasini ochadi) | — |
| 6 | **Allaqachon o'rnatilgan** | `existing.html` (**yangi**) | `running` (bool), eski versiya | `upgrade()`, `relink()`, `cancel()` | — |
| 7 | **Xatolik** | `error.html` (**yangi**) yoki oddiy modal | `message` | `close()` | — |

- 3-oyna oqimi: `connect.html` "Bog'landi" tugmasi olib tashlanadi — bu avtomatik
  (`client.WaitForLink` → `linked` event). Kod muddati `expires_at` dan sanaladi.
- 4→5 o'tishi: `onLinked` muvaffaqiyatli tugagach avtomatik `complete.html`.
- QR: Go tomonda `go-qrcode` bilan PNG → base64 → `<img src="data:image/png;base64,…">`
  (`connect.html` dagi `.qr-box` CSS namunasi o'rniga).

### Bola ilovasi — tray (`cmd/desktop`, doimiy)

| # | Oyna | HTML manbasi | Kirish | Chiqish | Jonli |
|---|------|--------------|--------|---------|-------|
| 8 | **Holat (tray)** | `status.html` (bor) | `child_name`, `today_minutes`, `limit_minutes`, `remaining`, `online`, `state` (ok/warn/offline) | `open_privacy()`, `close()` | oyna ochilganda `localipc.Status` dan; ochiq turса 30s'da yangilanadi |
| 9 | **Shaffoflik** | `privacy.html` (bor) | — | `back()` | — |
| 10 | **Kattalar — ogohlantirish** | `adult-gate.html` (**yangi**) | — | `continue()`, `cancel()` | — |
| 11 | **Kattalar paneli** | `adult-panel.html` (**yangi**) | `online`, `last_sync`, `version`, `today_minutes`, `log_path` | `help()`, `uninstall()`, `close()` | — |
| 12 | **Ma'lumot oynasi** ("Oxirgi amallar") | `info.html` (**yangi**, umumiy) | `title`, `body` | `close()` | — |

- `status.html` "child_name" — hozir agent bola ismini bilmaydi. Variant: enrollment
  paytida `verify-code` javobida `child_name` qaytarilsin va service argumentiga
  `-child-name` qo'shilsin; yoki `summary` endpoint'idan olinsin. Alohida kichik ish.
- `status.html` dagi `.window-head button` (kichraytirish) va `.tray-demo` footer —
  olib tashlanadi (bular mockup dekoratsiyasi).

### Block overlaylar (fullscreen, yopib bo'lmaydigan)

| # | Oyna | HTML manbasi | Qaror |
|---|------|--------------|-------|
| 13 | **Vaqt tugadi** | `limit-reached.html` (bor) | **Native (`block_screen.go`).** GDI bilan `limit-reached.html` ko'rinishiga yaqinlashtiriladi: teal fon, markazda "card" hissi (yorug'roq to'rtburchak), katta sarlavha + xotirjam matn + pastda brend. Anti-tamper: dev-tools yo'q, jarayonni yopib bo'lmaydi. |
| 14 | **Ilova cheklangan** | `app-restricted.html` (bor) | yuqoridagidek (moviyroq variant) |

- **Bu block oynalar hali enforcer'ga ulanmagan** (Session 0 service UI chizolmaydi;
  session helper'ga buyruq kanali kerak — alohida ish).

---

## 3. Bosqichlar

| Bosqich | Ish | Natija |
|---|---|---|
| **A. Infra** | go-webview2 dep, `webwin` helper, ichki HTTP server, `bridge.js`, offline shrift+ikonka, **1 oyna: Welcome** | pipeline isbotlangan, `uitest -screen welcome` WebView2'da |
| **B. Installer oqimi** | consent, connect (jonli QR/sanoq/linked), installing (step progress), complete, existing, error | `cmd/installer` to'liq WebView2 |
| **C. Tray oynalari** | status (jonli), privacy, adult-gate, adult-panel, info | `cmd/desktop` to'liq WebView2; walk oynalar o'chiriladi |
| **D. Block ekranlar** | native restyle (yoki webview — qarorga qarab) | `block_screen.go` HTML palitrasiga mos |
| **E. Runtime + test** | Inno'ga Evergreen bootstrapper + detection; Win10/Win11 toza mashina testi | installer WebView2 runtime'ni ta'minlaydi |

- walk kodi (`theme.go`, `consent_dialog.go`, `enrollment_wizard.go`,
  `welcome_complete.go`, `info_window.go`, `child_status_window.go`,
  `adult_panel.go`, `existing_install.go`) C bosqichdan keyin o'chiriladi.
  `systray` (tray ikonkasi) qoladi — u WebView2 emas.

## 4. Qarorlar (2026-09-01, tasdiqlangan)

1. **Brend/ohang — aralash:**
   - **Installer (1-7 oynalar): "ChaqimchiAI Guard", ota-ona ohangi** — professional,
     xotirjam. `agent/webui/welcome…complete.html` matni shunga moslashtiriladi
     (sarlavhalar, "bola/bolangiz" → operator ohangi, `brand small` = "Guard").
   - **Tray (8-12 oynalar): "ChaqimchiAI Child", yumshoq ohang** — bola ko'radi,
     `agent/webui/status.html` / `privacy.html` deyarli o'zgarmaydi.
   - Ikki auditoriya, bitta rang palitrasi (teal/blue glass).
2. **Block ekranlar (13-14): native Win32.** `block_screen.go` qayta bezaladi
   (`limit-reached.html` palitrasi: teal ground, glass card, katta sarlavha).
   WebView2 emas — anti-tamper uchun.
3. **Installer oyna o'lchami: ~960 × 620, 2-ustunli** `install-layout` (chap "art"
   panel ko'rinadi).
4. **`agent/webui/` promote — yagona manba.** Mockup'dan haqiqiy UI'ga: CDN olib
   tashlanadi, `bridge.js` + `assets/` qo'shiladi, dinamik joylar `data-bind`.
   Agent shu papkani `//go:embed` qiladi. `index.html` (dizayn ko'rsatkichi)
   qoladi, lekin embed'ga kirmaydi.

## 5. Risklar

- WebView2 runtime yo'q bo'lgan Win10 — bootstrapper hal qiladi, lekin +2 MB va
  o'rnatishda internet kerak bo'lishi mumkin (offline runtime ~150 MB — bundle qilinmaydi).
- Har oyna alohida `msedgewebview2.exe` (bir necha MB RAM) — o'tkinchi oynalar uchun muammo emas.
- SmartScreen: WebView2Loader.dll MS-imzolangan, muammo yo'q; installer hash o'zgaradi.
- go-webview2 — o'rtacha yetuk; ba'zi edge-case (DPI, oyna ikonkasi) qo'lda sozlash kerak.
