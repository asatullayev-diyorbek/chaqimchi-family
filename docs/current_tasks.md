# ChaqimchiAI Guard — Current Tasks

Sana: 2026-08-11  
Holat: rejalashtirish  
Asosiy maqsad: GUI bilan ishlaydigan, production API’ga ulangan va Windows 10/11’da tekshirilgan `ChaqimchiAI Guard Setup.exe` release candidate tayyorlash.

## Ishlash qoidasi

- Vazifalar quyidagi tartibda bajariladi.
- Har bosqich keyingi bosqichga o‘tishdan oldin o‘z checkpointidan o‘tishi kerak.
- Checkpoint o‘tmasa, public release qilinmaydi; muammo qayd etilib, alohida tuzatish vazifasi ochiladi.
- Agent, bootstrap yoki boshqa ichki `.exe` fayllar public tarqatilmaydi. Foydalanuvchiga faqat `ChaqimchiAI Guard Setup.exe` beriladi.
- Production’da faqat HTTPS ishlatiladi. Defender, SmartScreen, Firewall yoki UAC’ni o‘chirish tavsiya qilinmaydi.

## Hozirgi holat — 2026-08-28 yangilanishi (real Windows)

### Parent-web dashboard tuzatishlari (real foydalanuvchi test'idan) — deploy kutmoqda

- [x] **Farzand rasmi ko'rinmasdi:** `/media/` faqat `DEBUG=True` da route qilinardi → PA (`DEBUG=0`) da 404. `config/urls.py` da `django.views.static.serve` bilan doim serve qilinadi (DEBUG=0 bilan test PASS). ⚠️ PA dashboard'da `/media/` uchun konfliktli static mapping bo'lmasligi kerak.
- [x] **"Qurilmani uzish" ishlamasdi:** `/devices/[id]` sahifasidagi tugmada `onClick` yo'q edi (`unlinkDevice` API hech qayerda chaqirilmagan). Endi confirm + `unlinkDevice()` + `/devices` ga qaytadi. Backend `DELETE` allaqachon ishlaydi (prod'da 204 test PASS).
- [x] **Dashboard'dagi mock data olib tashlandi:**
  - `/devices/[id]`: soxta "saqlash" tugmasi, "Qo'lda sinxronlash", butun Settings tab (soxta toggle'lar), Model/IP/MAC/Internet/Versiya qatorlari; edit form endi `updateDevice()` ni haqiqatan chaqiradi (rename + `child_id` reassign).
  - `/devices`: `---` o'rniga haqiqiy umumiy ekran vaqti + onlayn son; batareya ustuni `summary.battery_percent` dan; bo'sh "Saqlash" ustuni va "Versiya kutilmoqda" olib tashlandi.
  - `/overview`: qattiq yozilgan "Faoliyat balli 85/100", soxta "Xavfsiz qidiruv"/"Tungi rejim" qoidalari, "AI tavsiyasi" bloki (AI MVP'da yo'q) olib tashlandi.
- [x] **Batareya endi haqiqiy:** summary endpoint eng oxirgi `device_state` event'dan `battery_percent` qaytaradi (yo'q/`-1` bo'lsa `null` → UI batareyani yashiradi).
- [x] **Qurilmani boshqa farzandga o'tkazish:** `DeviceDetailView` PATCH endi `child_id` ni ham qabul qiladi (family-scoped).
- [x] Backend testlari: **+5 yangi, 46/46 PASS**. Parent-web lint 0 error, build PASS.
- [ ] **Deploy kerak:** backend → PythonAnywhere (git pull + reload); parent-web → Vercel (branch merge yoki push). Backend deploy bo'lmaguncha rasm/batareya/reassign ishlamaydi (unlink esa hoziroq ishlaydi).

- [x] Ish real Windows 11 kompyuterga ko'chirildi (`Windows-da-davom-etish.md` bo'yicha). Go 1.27.0 zip orqali o'rnatildi (`C:\Users\Robbit\gosdk`, admin talab qilmaydi — winget MSI elevation'da osilib qoldi).
- [x] **Real Tracking E2E PASS** (`hisobot.md` §18): Guard agent real Windows'da foreground app'ni aniqladi → SQLite buffer → `POST /api/tracking/ingest/` (production) → `summary`/`history` → Dashboard. Bu edi loyihaning asosiy ochiq P0 bandi.
- [x] Go paket testlari va uchala Windows binary buildi (`cmd/agent`, `cmd/installer`, `cmd/desktop`) real Windows'da PASS.
- [x] **CT-03 PASS:** `go1.27.0 windows/amd64` (`C:\Users\Robbit\gosdk`), `goversioninfo.exe` (`go install`, `C:\Users\Robbit\go\bin`), Inno Setup 6.7.3 ISCC (`C:\Users\Robbit\InnoSetup6\ISCC.exe`, `/CURRENTUSER` install — admin shart emas). `signtool` yo'q (CT-08, unsigned MVP). Repo clean checkout.
- [x] **CT-05 PASS:** `build-guard-setup.ps1` to'liq ishladi → `releases\windows\ChaqimchiAI Guard Setup.exe` (22.4 MB, GUI subsystem, Inno Setup lzma2, packer yo'q). Embedded URL `https://api.guard.chaqimchi-ai.uz` (bootstrap). Metadata: ProductName "ChaqimchiAI Guard", ProductVersion `0.4.0-rc.1`, FileVersion `0.4.0.0`. **SHA-256:** `9D5743764B8A8B027FCFD293712F3145277057F08487911ADB477B45E6E8BD35`.
- [x] Build script tuzatildi (hech qachon ishga tushirilmagan, 5 ta latent bug): (1) `goversioninfo` >= v1.4 uchun base `versioninfo.json` positional arg kerak — vaqtinchalik `{}` fayl beriladi; (2) RC tegli versiyadan 4-qismli numeric versiya (`NumericVersion`) ajratiladi (`VersionInfoVersion`/`VersionInfoProductVersion` numeric bo'lishi shart); (3) Inno Setup 6.4+ `DisableSilentInstall` direktivini olib tashlagan — o'rniga `[Code] InitializeSetup` da `WizardSilent()` guard; (4) `compiler:Languages\English.isl` → `compiler:Default.isl` (Inno Setup'da inglizcha Default.isl); (5) `[UninstallRun]` ga `RunOnceId` qo'shildi.
- [x] **CT-08 qisman:** barcha 4 EXE metadata to'liq (Company "ChaqimchiAI", ProductName "ChaqimchiAI Guard", ProductVersion `0.4.0-rc.1`, Description bor). Consent oynasi (`internal/ui.RequireInstallerConsent`) faqat ruxsat etilgan kategoriyalarni ko'rsatadi (ilova/sayt nomlari, ekran vaqti, qurilma holati) va enrollment kodidan **oldin** ko'rsatiladi. Service DisplayName "ChaqimchiAI Guard Service", SCM id `ChaqimchiFamilyAgent`, installed exe `C:\Program Files\ChaqimchiAI\chaqimchi-agent.exe` — brendga mos, yashirin emas. Qolgan: code signing qarori (`signed` yoki `unsigned MVP`).
- [x] **CT-10 qisman:** `parent-web` `/download` sahifasi tuzatildi — endi eski bootstrap `.exe` (`ChaqimchiAI-Guard-Installer.exe`, 27 MB, ichki artifact — public tarqatish taqiqlangan) o'rniga to'g'ri `ChaqimchiAI-Guard-Setup.exe` beriladi. Sahifada versiya, sana, hajm, noshir (unsigned MVP) va SHA-256 ko'rsatiladi; SmartScreen bo'yicha halol izoh bor. `parent-web` lint + production build PASS. Qolgan: Privacy/Terms/Support havolalari, eski URL redirect.
- [~] **CT-06 boshlandi (Windows 11), 3 ta muammo topildi:**
  - **Bug #1 (tuzatildi, `.iss`):** `postinstall` `[Run]` bootstrap'ni elevation'siz chaqirar edi → `CreateProcess failed; code 740` (bootstrap `requireAdministrator`) → `runascurrentuser` flag qo'shildi.
  - **Bug #2 (tuzatildi, `.iss`):** `nowait` bilan ishga tushgan Desktop tray ilovasi uninstall paytida yopilmasdi → `.exe` va `{app}` papkasi o'chmay qolardi → `[UninstallRun]` ga `taskkill /f /im "ChaqimchiAI Guard Desktop.exe"` qo'shildi (service teardown'dan oldin).
  - **Bug #3 (ARXITEKTURA, MVP-BLOKER — TUZATILDI VA REAL WINDOWS'DA TASDIQLANDI 2026-08-28):** o'rnatilgan service SYSTEM sifatida **Session 0** da ishlaydi. `GetForegroundWindow()` Session 0 window station'ining faol oynasini qaytaradi (u yerda interaktiv ilova yo'q) → **hech qachon `app_usage` event yaratilmaydi** (real test: 5+ daqiqa, buffer'da 0 ta `app_usage`, faqat `device_state`). §18 dagi E2E faqat agent **foydalanuvchi seansida** to'g'ridan-to'g'ri ishga tushirilgani uchun ishlagan.
    **Tasdiq (real installed service, hotswap):** helper Session 1 da barqaror ishlaydi (respawn yo'q), buffer'ga `WindowsTerminal.exe`/`chrome.exe`/`explorer.exe` `app_usage` event'lari yozildi, `synced=1` (production backend qabul qildi). To'liq oqim: real foreground → helper (Session 1) → `POST /v1/foreground` → service (Session 0) → buffer → `/api/tracking/ingest/` → dashboard.
    **Yechim (variant 1 — session helper):** service rejimida agent `internal/session.RunReporter` orqali o'zining nusxasini `-foreground-reporter` bilan faol konsol seansiga spawn qiladi (`WTSQueryUserToken` + `CreateProcessAsUser`, `winsta0\default`); helper foreground'ni polling qilib `POST http://127.0.0.1:37641/v1/foreground` orqali service'ga yuboradi; service `tracker.RunAppUsageFromObservations` bilan `app_usage` event'larini yozadi. Helper o'lsa/seans almashsa qayta spawn qilinadi; service to'xtasa helper o'zi chiqadi. O'zgargan fayllar: `internal/session/reporter_windows.go` (yangi), `internal/tracker/app_usage_core.go` (yangi, portable state machine), `internal/tracker/app_usage.go`, `internal/localipc/status.go` (`POST /v1/foreground`), `cmd/agent/main.go`, `internal/service/windows_service.go`. Build ✅ vet ✅ 7 yangi test ✅.
    **Real testda topilgan 2 qo'shimcha bug (tuzatildi):**
    (a) helper `-parent-pid` liveness'ni `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)` bilan SYSTEM service PID'iga tekshirardi → **"Access is denied"** → har 10 sekundda respawn loop, event yig'ilmasdi. `OpenProcess` tekshiruvi olib tashlandi; helper faqat POST-xatolik backstop (12 ketma-ket → ~2 daq) va `RunReporter.TerminateProcess` bilan boshqariladi. `http.Client` transporti ham env-proxy'siz.
    (b) SCM crash-restart'dan keyin eski instansiyaning helper'i user seansida yetim qolib, yangi instansiyaning ishlaydigan IPC'siga POST qilaverardi (backstop hech qachon ishlamas) → yangi service instansiyasi spawn qilishdan oldin `killStrayReporters()` bilan har qanday boshqa `chaqimchi-agent.exe` ni terminate qiladi (SYSTEM sifatida user helper'ini o'ldira oladi).
  - **CT-06 tasdiqlangan checkpointlar (real installed service):**
    - Installer GUI konsolsiz; consent enrollment kodidan oldin; QR/6-xonali kod oynasi.
    - Parent link → service avtomatik: `ChaqimchiFamilyAgent` `Running`/`Automatic`/`LocalSystem`, to'g'ri arglar; `C:\ProgramData\ChaqimchiFamily\{buffer.db,rules.db}`.
    - **`app_usage` real ishlaydi:** helper Session 1 da barqaror; `WindowsTerminal.exe`/`chrome.exe`/`explorer.exe` event'lari buffer'ga yozildi, `synced=1` (production ingest qabul qildi).
    - **Crash-recovery:** `taskkill /F` service jarayoni → SCM 5s'da qayta ishga tushirdi → yangi service + yangi helper, **yetim jarayon yo'q** (`killStrayReporters`). Recovery config `RESTART 5s/5s/30s`, reset 86400s.
    - **Uninstall:** `unins000.exe /VERYSILENT` → service, `C:\Program Files\ChaqimchiAI`, `C:\ProgramData\ChaqimchiFamily`, registry to'liq tozalandi.
  - **Bug #4 (installer GUI — tuzatildi):** enrollment wizard oynasi ochilmasdi, o'rniga xunuk MessageBox (`chaqimchi://enroll?...` xom URL, QR yo'q) chiqardi. Sabab: `installer.manifest` da `Microsoft.Windows.Common-Controls` v6 dependency yo'q → `lxn/walk` common controls init muvaffaqiyatsiz → fallback. `installer.manifest` + yangi `cmd/desktop/desktop.manifest` ga Common-Controls + `dpiAware` + `supportedOS` qo'shildi. Screenshot: QR endi to'g'ri render bo'ladi.
  - **Bug #5 (installer GUI — dizayn yaxshilandi):** matn/oyna "xunuk" edi. `lxn/walk/declarative` bilan qayta yozildi: brend sarlavha + teal marka, tipografik ierarxiya, QR oq ramkali kartada, kod `482 913` katta bold. **Consent oynasi** xom MessageBox o'rniga to'liq oyna — 2 ustunli shaffoflik jadvali (yashil ✓ / qizil ✕), "O'qidim" checkbox belgilanmaguncha "Davom etish" o'chirilgan (dizayn §3.2). Yangi `internal/ui/theme.go`; `cmd/uitest` — oynalarni o'rnatishsiz ko'rish harnessi.
  - **Qolgan:** yangi installer bilan **toza** o'rnatish (hotswap emas — Bug #4/#5 real oqimda tasdiqlanadi); Windows 10; haqiqiy reboot orqali autostart.
- [x] **CT-09 qisman PASS:** SHA-256 `9D5743764B8A8B027FCFD293712F3145277057F08487911ADB477B45E6E8BD35` (sidecar `.sha256` yozildi); Windows Defender scan (final installer + 3 ichki EXE) — hammasi "found no threats". **VirusTotal ochiq** (API kalit / qo'lda yuklash kerak; unsigned Go binariy — 2–10 evristik FP kutiladi).
- [~] Kichik muammo: UWP ilovalar (masalan Calculator) foreground'da `ApplicationFrameHost.exe` sifatida ko'rinadi; Win32 ilovalar to'g'ri nomlanadi. MVP-blocker emas.
- [~] `parent-web/public/downloads/*.exe` repo'ga commit qilinadi (Vercel static serve). Eski 27 MB fayl o'chirildi, yangi 22 MB qo'shildi — commit qilishdan oldin ko'rib chiqing (yoki Vercel'ga alohida yuklash).

## Hozirgi holat — 2026-08-23 yangilanishi

- [x] Backend PythonAnywhere Free tarifda joylashtirildi: `https://apiguard.pythonanywhere.com` (health check PASS, CORS PASS).
- [x] Frontend (parent-web) GitHub'ga push qilindi va Vercel'ga ulandi: `https://chaqimchi-family-parent-web.vercel.app` (production, git auto-deploy yoqilgan).
- [x] Custom domen `api.guard.chaqimchi-ai.uz` Cloudflare Worker (`apiguard-proxy`, Host-rewrite proxy → `apiguard.pythonanywhere.com`) orqali ulandi. DNS + SSL avtomatik (Cloudflare Workers Custom Domain). Health check PASS: `https://api.guard.chaqimchi-ai.uz/api/health/` → `200 {"status":"ok"}`.
- [x] CT-01 va CT-02 checkpointlari shu konfiguratsiya bilan qayta tekshirildi va PASS: barcha client'lar (`parent-web` Vercel env, `parent-mobile/.env`, `parent-web/.env.local`) canonical `https://api.guard.chaqimchi-ai.uz` ga o'tkazildi, eski ngrok qiymatlari olib tashlandi.
- [ ] PA Free web app 3 oyda bitta qo‘lda "Run until 3 months" bosilishi kerak (dashboard orqali, keyingi muddat: 2026-09-23) — API bu ishni bajara olmaydi.
- [ ] Vercel loyihasida Root Directory dashboard'da `parent-web` ga qo‘lda o‘rnatilishi kerak (CLI buni sozlay olmaydi) — hali bajarilmagan, keyingi git-triggered build shu sababli muvaffaqiyatsiz bo'lishi mumkin.
- [x] **Muhim tuzatish (2026-08-23):** installer avval enrollment linkni WebSocket (`ws/enroll/<device_id>/`) orqali kutar edi — PA WSGI-only bo'lgani uchun bu har safar darhol xato berardi (foydalanuvchiga xom Go xatosi ko'rinardi) va QR oynasi "ishlamayapti" taassurotini kuchaytirardi. Endi `GET /api/enroll/status/<device_id>/` orqali polling qilinadi (`agent/internal/enroll/client.go`). `apps/devices` dagi eski WS consumer endi hech qayerda ishlatilmaydi (dead code, kelajakda olib tashlanishi mumkin).
- [x] QR ImageView `ImageViewModeZoom` rejimiga o'tkazildi (`agent/internal/ui/enrollment_wizard.go`) — eski default Ideal rejim DPI-scaling yoki tor fixed-size oynada QR joyini bo'sh qoldirishi mumkin edi. **Bu Windows'da hali sinalmagan — keyingi build/test kerak.**
- [ ] PA Free tarif WSGI-only; `apps/devices` dagi enroll WebSocket consumer endi to'liq ishlatilmaydigan kod.
- [ ] Baza hozircha PA'da sqlite (production Postgres emas) — Bosqich 0 uchun yetarli, kattaroq foydalanuvchi bazasida tashqi Postgres (masalan Neon) ulanishi kerak bo'ladi.

## Eski holat

- [x] Eski console-subsystem installerlar `releases/windows/archive/` ichiga ko‘chirildi.
- [x] GUI bootstrap test build yaratildi.
- [x] Bootstrap va desktop buildlari uchun GUI subsystem tekshiruvi qo‘shildi.
- [x] Final Inno Setup installer uchun GUI subsystem gate qo‘shildi.
- [x] Windows target uchun Go package’lar compile tekshiruvdan o‘tdi.
- [ ] Production API domeni real internetdan ishlashi tasdiqlanmagan.
- [ ] To‘liq Inno Setup installer Windows’da build qilinmagan.
- [ ] Installer real Windows 10/11 muhitida end-to-end test qilinmagan.
- [ ] Release security va distribution gate’laridan o‘tmagan.
- [~] CT-01 tekshirildi: Cloudflare nameserverlar faol, root/`www` yozuvlari bor, ammo frontend origin `502` qaytaryapti va `api.guard` DNS recordi public resolver’da ko‘rinmayapti.
- [~] CT-02 audit boshlandi: client va backend production URL’lari hali ngrok/fallback qiymatlarida.
- [~] CT-03 development uchun yetarli deb belgilandi; Windows release validation bosqichigacha deferred.
- [x] CT-04 RC versiyasi va changelog qarori belgilandi: `0.4.0-rc.1`.
- [~] CT-05 faqat preflight audit qilindi; actual build/test Windows muhitiga qoldirildi.

---

## CT-01 — Production domenlar sxemasini yakunlash

**Vazifa:** loyiha ishlatadigan rasmiy frontend, API va keyingi update domenlarini aniq belgilash.

**Goal:** barcha komponentlar bitta kelishilgan domen sxemasidan foydalanishi va eski/ngrok hostname’lar production oqimiga aralashmasligi.

**Tavsiya etilgan sxema:**

- Web: `https://chaqimchi-ai.uz`
- Web alias: `https://www.chaqimchi-ai.uz`
- API: `https://api.guard.chaqimchi-ai.uz`
- Update kanali, keyingi bosqich: `https://update.chaqimchi-ai.uz`

**Qanday bajarish mumkin:**

1. Cloudflare DNS Records ichida root, `www` va `api` yozuvlarini ko‘rib chiqish.
2. Root va `www` yozuvlarini frontend hostingga yo‘naltirish.
3. `api` yozuvini Django backend ishlaydigan server yoki tunnel/proxy’ga yo‘naltirish.
4. Cloudflare SSL/TLS rejimini backend sertifikatiga qarab `Full (strict)` qilish.
5. Eski `chaqimchiai.uz` va ngrok manzillari production hujjatlari yoki environment konfiguratsiyasida ishlatilmasligini audit qilish.

**Checkpoint CT-01:**

- [ ] `chaqimchi-ai.uz` public DNS orqali resolve bo‘ladi.
- [ ] `www.chaqimchi-ai.uz` public DNS orqali resolve bo‘ladi.
- [ ] `api.guard.chaqimchi-ai.uz` public DNS orqali resolve bo‘ladi.
- [ ] Uchala kerakli hostda TLS sertifikati valid.
- [ ] `https://api.guard.chaqimchi-ai.uz/api/health/` HTTP 200 qaytaradi.
- [ ] API javobida Cloudflare yoki hosting xato sahifasi emas, Django health javobi keladi.

**Done mezoni:** frontend va API internetdan barqaror HTTPS orqali ochiladi; production uchun yagona canonical hostname yozib qo‘yilgan.

### CT-01 bajarilish natijasi — 2026-08-11

Public DNS tekshiruvi `1.1.1.1` orqali bajarildi:

- `chaqimchi-ai.uz` → `104.21.90.3`, `172.67.150.128` (Cloudflare proxy IP’lari).
- `www.chaqimchi-ai.uz` → `104.21.90.3`, `172.67.150.128` (Cloudflare proxy IP’lari).
- `chaqimchi-ai.uz` nameserverlari → `ali.ns.cloudflare.com`, `yadiel.ns.cloudflare.com`.
- `api.guard.chaqimchi-ai.uz` → public resolver’da A yoki CNAME record topilmadi.
- `https://chaqimchi-ai.uz` → HTTP `502`.
- `https://www.chaqimchi-ai.uz` → HTTP `502`.
- `https://api.guard.chaqimchi-ai.uz/api/health/` → DNS resolve bo‘lmadi.

**CT-01 holati (eski, 2026-08-11):** `BLOCKED`.

**Blocker (eski):** Cloudflare zone faol, lekin frontend uchun origin hozir javob bermayapti; `api.guard` subdomain recordi public DNS’da ko‘rinmayapti yoki unga mos backend origin hali ulanmagan.

### CT-01 qayta tekshiruvi — 2026-08-23

`api.guard.chaqimchi-ai.uz` Cloudflare Worker (`apiguard-proxy`) orqali `apiguard.pythonanywhere.com`'ga ulandi. Health check PASS: `https://api.guard.chaqimchi-ai.uz/api/health/` → `200 {"status":"ok"}`. Frontend Vercel'da (`https://chaqimchi-family-parent-web.vercel.app`) production'da ishlayapti; `chaqimchi-ai.uz`/`www` root domenlarining Vercel'ga ulanishi hali alohida tasdiqlanmagan (hozircha Vercel default domenidan foydalanilmoqda).

**CT-01 holati:** `PASS` (API health-check va custom domen bo‘yicha). Root/`www` domenini Vercel'ga ulash hali ochiq — bu alohida DNS ishi, kod ishiga bog‘liq emas.

---

## CT-02 — Production API konfiguratsiyasini tasdiqlash

**Vazifa:** frontend, mobil ilova, backend va Windows installer bir xil production API URL’dan foydalanishini ta’minlash.

**Goal:** login, enrollment, tracking va installer oqimlari `https://api.guard.chaqimchi-ai.uz` orqali ishlashi.

**Qanday bajarish mumkin:**

1. Frontend production environment qiymatini tekshirish: `NEXT_PUBLIC_API_URL`.
2. Mobil build environment qiymatini tekshirish: `EXPO_PUBLIC_API_URL`.
3. Backend public URL qiymatini tekshirish: `CHAQIMCHI_PUBLIC_API_URL`.
4. Backend CORS va CSRF trusted origin ro‘yxatida root va `www` domenlari borligini tekshirish.
5. Installer build parametri sifatida aynan `https://api.guard.chaqimchi-ai.uz` berilishini tasdiqlash.
6. Production konfiguratsiyada `localhost`, private IP yoki ngrok fallback ishlatilmayotganini tekshirish.

**Checkpoint CT-02:**

- [ ] Web login production API’ga so‘rov yuboradi.
- [ ] CORS xatosi yo‘q.
- [ ] Backend public URL to‘g‘ri download/enrollment URL hosil qiladi.
- [ ] Installer ichidagi server URL HTTPS va canonical API hostga teng.
- [ ] Maxfiy environment qiymatlari repo yoki build logiga chiqmagan.

**Done mezoni:** barcha production clientlar bir API hostdan foydalanadi va browser/API xavfsizlik sozlamalari mos.

### CT-02 audit natijasi — 2026-08-11

- `parent-web/.env.local` → `https://ora-splittable-illuminatedly.ngrok-free.dev`.
- `parent-mobile/.env` → `https://ora-splittable-illuminatedly.ngrok-free.dev`.
- Backend `CHAQIMCHI_PUBLIC_API_URL` environment orqali berilmasa, eski ngrok fallback’dan foydalanadi.
- Windows build script defaulti eski `https://api.chaqimchiai.uz` qiymatida; canonical production host emas.
- Django CORS default ro‘yxatida `https://chaqimchi-ai.uz` va `https://www.chaqimchi-ai.uz` mavjud.
- `api.guard.chaqimchi-ai.uz` public DNS’da hali resolve bo‘lmagani sabab API health va production login tekshiruvi bajarilmadi.

**CT-02 holati (eski, 2026-08-11):** `IN PROGRESS / BLOCKED`.

**Blocker (eski):** `api.guard.chaqimchi-ai.uz` DNS va backend origin tayyor emas; mavjud client/backend environment’lar production canonical hostga o‘tkazilmagan.

### CT-02 qayta tekshiruvi — 2026-08-23

`parent-web` (Vercel env), `parent-mobile/.env` va `parent-web/.env.local` barchasi canonical `https://api.guard.chaqimchi-ai.uz` ga o‘tkazildi, eski ngrok qiymatlari olib tashlandi. CT-07 API-darajasidagi end-to-end test (login, enroll, tracking, alerts, tenant isolation) shu host orqali PASS bo‘ldi.

Hali tekshirilmagan: Windows build script defaultidagi eski `https://api.chaqimchiai.uz` qiymati (CT-05/CT-06 doirasida, Windows muhitida tekshiriladi) va installer parametri sifatida canonical host berilishi.

**CT-02 holati:** `PASS` (web/mobile/backend production environment’lari uchun). Installer build parametri PASS holati Windows release bosqichida (CT-05/CT-06) tasdiqlanadi.

---

## CT-03 — Windows release muhitini tayyorlash

**Vazifa:** toza Windows release mashinasi yoki VM tayyorlash.

**Goal:** installer buildi takrorlanuvchi va hujjatlashtirilgan muhitda yig‘ilishi.

**Qanday bajarish mumkin:**

1. Windows 11 x64 release VM tayyorlash; imkon bo‘lsa alohida Windows 10 x64 test VM ham tayyorlash.
2. Git va loyihaning mos Go versiyasini o‘rnatish.
3. Inno Setup 6 ni o‘rnatish va `iscc.exe` mavjudligini tekshirish.
4. `goversioninfo` vositasini o‘rnatish.
5. Signing rejalashtirilsa, Windows SDK va `signtool.exe` ni tayyorlash.
6. Repo’ni clean checkout orqali release mashinasiga olish.
7. Build boshlanishidan oldin ishlatiladigan commit hash va build vaqtini qayd etish.

**Checkpoint CT-03:**

- [ ] `go version` kutilgan versiyani ko‘rsatadi.
- [ ] `iscc.exe` command line’dan ishlaydi.
- [ ] `goversioninfo.exe` command line’dan ishlaydi.
- [ ] Repo clean checkout holatida.
- [ ] Release mashinasida oldingi installer qoldiqlari buildga aralashmaydi.

**Done mezoni:** bitta PowerShell build buyrug‘ini ishga tushirishga tayyor Windows muhiti mavjud.

### CT-03 audit natijasi — 2026-08-11

- Host: macOS ARM64 (`Darwin`, Apple Silicon).
- Go: `go1.26.5` mavjud; `GOOS=windows`, `GOARCH=amd64` cross-compile mumkin.
- Inno Setup `iscc.exe`: topilmadi.
- `goversioninfo.exe`: topilmadi.
- `signtool.exe`: topilmadi.
- Repo clean checkout emas; hozirgi worktree’da 88 ta mavjud o‘zgarish bor.

**CT-03 holati:** `DEFERRED FOR RELEASE VALIDATION`.

**Izoh:** hozirgi macOS ARM64 muhit development, cross-compile va kod/test ishlari uchun yetarli. Windows 10/11 x64 muhit faqat to‘liq Inno Setup buildi, GUI runtime, Windows Service, UAC, uninstall va SmartScreen/Defender tekshiruvlari uchun talab qilinadi.

**Keyingi amaliy ish:** development bosqichida CT-04 va keyingi kod/API ishlarini davom ettirish. Release candidate tayyor bo‘lganda Windows release VM/mashinasini tayyorlash, Inno Setup 6 va `goversioninfo` o‘rnatish, keyin CT-03 checkpointlarini qayta tekshirish.

---

## CT-04 — Versiya va release candidate nomini belgilash

**Vazifa:** test artifactlar va public release uchun aniq versiyalash qarorini qabul qilish.

**Goal:** eski `v1/v2/v3` test fayllari bilan yangi professional installer aralashib ketmasligi.

**Tavsiya:** ichki test uchun `0.4.0-rc.1`, barcha gate’lardan o‘tgach public MVP uchun `0.4.0`.

**Qanday bajarish mumkin:**

1. Release versiyasini tasdiqlash.
2. Release candidate va final release farqini yozib qo‘yish.
3. Windows File Version to‘rtta son talab qilsa `0.4.0.0`, foydalanuvchi ko‘radigan product version uchun `0.4.0` ishlatish.
4. `CHANGELOG.md` uchun installer GUI fix, GUI gate va production API o‘zgarishlarini tayyorlash.
5. Public fayl nomini versiyasiz barqaror saqlash: `ChaqimchiAI Guard Setup.exe`.

**Checkpoint CT-04:**

- [ ] RC versiya tasdiqlangan.
- [ ] Final MVP versiya tasdiqlangan.
- [ ] Changelog mazmuni tayyor.
- [ ] Public va ichki artifact nomlari aniq ajratilgan.

**Done mezoni:** build jarayoniga beriladigan versiya va release nomlash siyosati bo‘yicha noaniqlik qolmagan.

### CT-04 bajarilish natijasi — 2026-08-11

- RC versiya: `0.4.0-rc.1`.
- Rejalashtirilgan public MVP: `0.4.0`.
- `CHANGELOG.md` yaratildi va RC cheklovlari qayd qilindi.
- Eski `v1/v2/v3` fayllar test artifactlari sifatida qaraladi, semver release emas.
- Git tag hozircha yaratilmaydi; avval CT-01, CT-02 va Windows release checkpointlari yakunlanadi.

**CT-04 holati:** `COMPLETED`.

---

## CT-05 — To‘liq Inno Setup installer build qilish

**Vazifa:** Windows release mashinasida professional installer yig‘ish.

**Goal:** foydalanuvchiga tarqatiladigan yagona GUI installer hosil qilish.

**Qanday bajarish mumkin:**

1. CT-01 va CT-02’dan o‘tgan canonical API URL’ni olish.
2. `scripts/windows/build-guard-setup.ps1` ni tanlangan RC versiya va API URL bilan ishga tushirish.
3. Script yaratgan agent, bootstrap va desktop EXE metadata/icon’larini tekshirish.
4. Inno Setup compile natijasini `releases/windows/ChaqimchiAI Guard Setup.exe` sifatida olish.
5. Build logini saqlash.
6. Final installerga SHA-256 hisoblash va build manifestga yozish.

**Checkpoint CT-05:**

- [ ] PowerShell build xatosiz yakunlangan.
- [ ] `ChaqimchiAI Guard Setup.exe` mavjud.
- [ ] Bootstrap, desktop va final installer GUI subsystem gate’dan o‘tgan.
- [ ] Installer iconi va Windows metadata bo‘sh emas.
- [ ] Embedded backend URL `https://api.guard.chaqimchi-ai.uz`.
- [ ] Buildda UPX yoki boshqa packer ishlatilmagan.
- [ ] SHA-256 hash qayd etilgan.

**Done mezoni:** real Windows’da ishga tushirish uchun tayyor, lekin hali public qilinmagan RC installer mavjud.

### CT-05 preflight audit natijasi — 2026-08-11

- Build script mavjud.
- Inno Setup script mavjud.
- Brend iconi mavjud.
- Embedded agent payload mavjud; uning console subsystem holati normal, chunki release script uni `-H=windowsgui` bilan qayta build qiladi.
- PowerShell, Inno Setup `iscc.exe` va `goversioninfo.exe` macOS development muhitida mavjud emas.
- Build script defaultida eski hostname bor; Windows build vaqtida canonical parametr majburiy ishlatiladi:

```powershell
.\scripts\windows\build-guard-setup.ps1 `
  -Version 0.4.0-rc.1 `
  -ServerUrl https://api.guard.chaqimchi-ai.uz
```

**CT-05 holati:** `DEFERRED FOR WINDOWS BUILD`.

**Izoh:** CT-05 macOS’da test qilinmadi va test qilingan deb hisoblanmaydi. Hozirgi audit faqat buildga kiradigan fayllar va muhim parametrlarni ko‘rib chiqdi. To‘liq installer faqat Windows release mashinasida yig‘iladi va o‘sha yerda tekshiriladi.

**Keyingi amaliy ish:** Windows release muhitida yuqoridagi command bilan RC installer build qilish, final GUI gate va SHA-256 natijasini qayd etish.

### CT-05 bajarilish natijasi — 2026-08-28 (real Windows 11)

`build-guard-setup.ps1` real Windows 11'da to'liq bajarildi (birinchi marta — CT-05 shu paytgacha "DEFERRED" edi). Script'da 5 ta latent bug topildi va tuzatildi (yuqoridagi 2026-08-28 holat bo'limiga qarang).

- [x] PowerShell build xatosiz yakunlandi (Inno Setup warning'lar ham yo'q).
- [x] `releases\windows\ChaqimchiAI Guard Setup.exe` yaratildi — 22 455 047 bayt (~21.4 MB).
- [x] Bootstrap, desktop va final installer GUI subsystem gate (`Assert-GuiExecutable`, PE subsystem = 2) — PASS.
- [x] Installer icon (`parent-web\src\app\favicon.ico`) va Windows metadata to'liq: ProductName `ChaqimchiAI Guard`, ProductVersion `0.4.0-rc.1`, FileVersion `0.4.0.0`, Company `ChaqimchiAI`.
- [x] Embedded backend URL `https://api.guard.chaqimchi-ai.uz` — bootstrap `.exe` ichida tasdiqlandi.
- [x] Packer yo'q: PE seksiyalari standart Inno Setup (`.text/.itext/.data/.bss/.idata/.didata/.edata/.tls/.rdata/.reloc/.rsrc`), `UPX0/UPX1` yo'q. Inno Setup `Compression=lzma2`.
- [x] **SHA-256:** `9D5743764B8A8B027FCFD293712F3145277057F08487911ADB477B45E6E8BD35`

**CT-05 holati:** `PASS` (RC installer yig'ildi, hali public emas). Keyingi: CT-06 (Windows 10/11 qo'lda GUI/lifecycle test), CT-09 (VirusTotal/Defender).

---

## CT-06 — Installer GUI oqimini Windows’da test qilish

**Vazifa:** RC installer’ni toza Windows 10/11 muhitida qo‘lda sinash.

**Goal:** o‘rnatish, rozilik, enrollment, service va uninstall oqimlari foydalanuvchi ko‘radigan tarzda to‘liq ishlashi.

**Qanday bajarish mumkin:**

1. Avval Windows 11 clean snapshot’da installer’ni oddiy double-click bilan ishga tushirish.
2. Welcome, transparency/consent, install progress va finish oynalarini tekshirish.
3. QR-kod va 6 xonali kod oynasini tekshirish.
4. Parent ilova orqali real enrollment bajarish.
5. Kod expiration, bekor qilish va internet yo‘q holatlarini alohida sinash.
6. `services.msc` orqali Guard Service holatini tekshirish.
7. Desktop/tray holati va xatolik MessageBox’larini tekshirish.
8. Rebootdan so‘ng service qayta ishga tushishini tekshirish.
9. Uninstall qilib service, program files va ruxsat etilgan local data tozalanganini tekshirish.
10. Shu testlarni Windows 10’da takrorlash.

**Checkpoint CT-06:**

- [ ] Installer console oynasisiz GUI sifatida ochiladi.
- [ ] Rozilik olinmasdan enrollment boshlanmaydi.
- [ ] QR-kod to‘g‘ri render bo‘ladi va skanerlanadi.
- [ ] 6 xonali kod o‘qiladi va ishlaydi.
- [ ] Kod muddati tugaganda yangi kod oqimi ishlaydi.
- [ ] Bekor qilish ilovani xavfsiz yopadi.
- [ ] Internet/API xatosi foydalanuvchiga tushunarli ko‘rsatiladi.
- [ ] Enrollment muvaffaqiyatli yakunlanadi.
- [ ] Guard Service `Running` holatida.
- [ ] Rebootdan keyin service qayta ishlaydi.
- [ ] Uninstall muvaffaqiyatli va xizmat qoldig‘i qolmaydi.
- [ ] Windows 10 va Windows 11 natijalari qayd etilgan.

**Done mezoni:** barcha kritik GUI va lifecycle testlar PASS; topilgan muammolar screenshot/log bilan alohida vazifaga aylantirilgan.

---

## CT-07 — Parent ↔ installer ↔ backend end-to-end test

**Vazifa:** real productionga yaqin muhitda to‘liq qurilma bog‘lash va ma’lumot oqimini tekshirish.

**Goal:** yangi o‘rnatilgan Windows qurilma parent hisobiga bog‘lanishi va dashboard’da ko‘rinishi.

**Qanday bajarish mumkin:**

1. Yangi test parent hisobi yaratish.
2. Installer orqali enrollment code olish.
3. Parent web yoki mobil ilovada kod/QR orqali qurilmani bog‘lash.
4. Qurilma parent dashboard’da chiqishini tekshirish.
5. Agentdan tracking batch yuborilishini kutish.
6. Activity, alerts va rules oqimlarining asosiy qismini tekshirish.
7. Boshqa parent hisobidan shu qurilmaga kira olmaslikni tenant isolation testi bilan tasdiqlash.

**Checkpoint CT-07:**

- [x] Signup/login ishlaydi.
- [x] Enrollment code API’dan olinadi.
- [x] Parent qurilmani bog‘laydi.
- [x] Qurilma dashboard’da to‘g‘ri family ostida ko‘rinadi.
- [x] Tracking ma’lumoti serverga keladi.
- [x] Parent faqat o‘z qurilmasini ko‘radi.
- [x] Rules/alerts uchun minimal smoke test o‘tadi.

**Done mezoni:** real foydalanuvchi yo‘li installer’dan dashboard’gacha uzilmasdan ishlaydi.

### CT-07 bajarilish natijasi — 2026-08-23

Production canonical API (`https://api.guard.chaqimchi-ai.uz`) ustida to‘liq API-darajasidagi end-to-end test o‘tkazildi (haqiqiy Windows installer o‘rniga — bu CT-06’ga tegishli va hali bajarilmagan — `generate-code`/`ingest`/`report` endpointlari to‘g‘ridan-to‘g‘ri chaqirib, installer va agentning real xatti-harakati simulyatsiya qilindi):

1. Parent A signup + login — `PASS`.
2. `POST /api/enroll/generate-code/` (installer, auth yo‘q) — device_id, device_secret, 6 xonali kod qaytardi — `PASS`.
3. Parent A `POST /api/enroll/verify-code/` orqali qurilmani bog‘ladi — status `linked` — `PASS`.
4. `GET /api/devices/` — qurilma Parent A oilasi ostida ko‘rindi — `PASS`.
5. Agent simulyatsiyasi: `POST /api/tracking/ingest/` (`Authorization: Device <id>:<secret>`) — event saqlandi — `PASS`.
6. `GET /api/tracking/summary/<device_id>/` — screen-time to‘g‘ri hisoblandi (10 daqiqa, `chrome`) — `PASS`.
7. Agent simulyatsiyasi: `POST /api/alerts/report/` — alert yaratildi — `PASS`.
8. Parent A `GET /api/alerts/<device_id>/` va `POST /api/rules/<device_id>/` — ikkalasi ham ishladi — `PASS`.
9. **Tenant isolation:** Parent B (yangi hisob) yaratildi; Parent B uchun `GET /api/devices/` bo‘sh qaytdi; Parent A qurilmasiga `summary`, `alerts` va `PATCH /api/devices/` orqali kirishga urinish uchtalasida ham `403 Forbidden` bilan rad etildi — `PASS`.

**CT-07 holati:** `PASS (API-darajasida)`. Haqiqiy Windows installer orqali fizik qurilmada enrollment (QR-kod skanerlash, real agent binary) hali sinalmagan — bu CT-06 doirasida, Windows muhitida bajariladi.

---

## CT-08 — Security, metadata va signing qarori

**Vazifa:** release’ning Windows trust va xavfsizlik holatini baholash.

**Goal:** installer shaffof, tekshiriladigan va MVP/Beta siyosatiga mos bo‘lishi.

**Qanday bajarish mumkin:**

1. Har bir ichki EXE va final installer metadata/icon’ini ko‘rib chiqish.
2. Installer silent yoki hidden install qilmasligini tasdiqlash.
3. Service display name va executable nomlari brendga mosligini tekshirish.
4. Code signing sertifikati mavjudligini aniqlash.
5. Sertifikat mavjud bo‘lsa agent/bootstrap/final installer’ni bir publisher bilan imzolash va timestamp qo‘yish.
6. Sertifikat mavjud bo‘lmasa unsigned MVP qarorini release notes’da ochiq ko‘rsatish; SmartScreen’ni o‘chirish bo‘yicha ko‘rsatma bermaslik.
7. Imzolangan bo‘lsa `signtool verify /pa` natijasini saqlash.

**Checkpoint CT-08:**

- [x] Product Name, Company, Description, Version va icon mavjud.
- [x] Installer yashirin/silent o‘rnatmaydi.
- [x] Faqat ruxsat etilgan monitoring kategoriyalari consent oynasida ko‘rsatiladi.
- [x] Code signing holati aniq: **`unsigned MVP`**.
- [x] Signed bo‘lsa signature va timestamp valid — *tegishli emas (imzolanmagan).*
- [x] Sertifikat/PFX/parol repo va loglarda yo‘q — imzolash umuman qilinmagani
      uchun bunday sir mavjud emas.

### Qaror — 2026-08-29: MVP imzolanmagan holda chiqadi

Egasi qarori: MVP bosqichida code signing sertifikati **sotib olinmaydi**.

Amaliy oqibati: har bir foydalanuvchi o‘rnatishда SmartScreen
"Windows protected your PC" ekranini ko‘radi va "More info → Run anyway"
bosishi kerak. Shuning uchun:

- `/download` sahifasi buni **oldindan va halol** tushuntiradi (allaqachon
  shunday — CT-10 doirasida yozilган), SHA-256 bilan birga.
- SmartScreen’ни o‘chirish yoki chetlab o‘tиш bo‘yicha ko‘rsatma **berilmaydi**.
- Ishonch reputatsiya orqali yig‘iladi: `docs/windows-trust-reputation-strategy.md`.

Qayta ko‘riб chiqish nuqtasi: birinchi real foydalanuvchilar oqimi
boshlanганda o‘rnatишdan voz kechиш darajasi o‘lchanadi. Agar SmartScreen
sezilarli to‘siq bo‘lса, sertifikat masalasi qayta ochилаdi.

**Done mezoni:** release’ning trust holati hujjatlashtirilgan va xavfsizlik siyosatiga mos.

**CT-08 holati:** `PASS (unsigned MVP)`.

---

## CT-09 — Antivirus, VirusTotal va integrity gate

**Vazifa:** final RC installer’ni zararli dastur sifatida noto‘g‘ri aniqlanish ehtimoliga tekshirish.

**Goal:** tarqatiladigan fayl yaxlitligi tasdiqlangan va antivirus natijalari qabul qilinadigan darajada bo‘lishi.

**Qanday bajarish mumkin:**

1. Final RC SHA-256 hashini qayta hisoblash va build natijasi bilan solishtirish.
2. Windows Defender bilan local scan qilish.
3. VirusTotal’ga aynan final public artifactni yuborish.
4. Detection chiqsa vendor, detection nomi va sababini tahlil qilish.
5. Ko‘p detection bo‘lsa release’ni bloklash.
6. Aniq false-positive bo‘lsa tegishli vendor/Microsoft portaliga submission qilish.

**Checkpoint CT-09:**

- [ ] SHA-256 builddan keyin o‘zgarmagan.
- [ ] Windows Defender local scan clean.
- [ ] VirusTotal natijasi qayd etilgan.
- [ ] Maqsad: 0–1 detection.
- [ ] Ko‘p detection mavjud bo‘lsa release `BLOCKED` deb belgilangan.
- [ ] False-positive submission kerak bo‘lsa yuborilgan va reference saqlangan.

**Done mezoni:** integrity va antivirus gate PASS yoki release sabab bilan bloklangan.

### CT-09 bajarilish natijasi — 2026-08-28 (qisman)

Local qism bajarildi, VirusTotal foydalanuvchining API kaliti / qo'lda yuklashini kutmoqda.

- [x] **SHA-256 builddan keyin o'zgarmagan:** `9D5743764B8A8B027FCFD293712F3145277057F08487911ADB477B45E6E8BD35` (22 397 929 bayt). `releases/windows/ChaqimchiAI Guard Setup.exe.sha256` sidecar yaratildi (`sign-release.ps1` formatida: `<hash>  <name>`).
- [x] **Windows Defender local scan clean:** `MpCmdRun.exe -Scan -ScanType 3` — final installer + uchala ichki EXE (`ChaqimchiAI Guard.exe`, `... Installer.exe`, `... Desktop.exe`) → hammasi "found no threats", exit 0. Real-time protection yoqilgan holatda build qilingan, quarantine bo'lmagan. Signature 1.457.286.0 (2026-08-22).
- [ ] **VirusTotal:** yuklanmagan — VT API kaliti yo'q. Eslatma: installer **imzolanmagan** (CT-08 "unsigned MVP"). Imzolanmagan Go binariylar VT'da odatda bir nechta evristik false-positive oladi (Go-specific: "Wacatac", "Trojan.Generic" kabi) — 2–10 detection kutilishi mumkin, bu MVP uchun normal, lekin qayd etilishi kerak.
- [ ] Detection tahlili / BLOCKED qarori / false-positive submission — VT natijasidan keyin.

**CT-09 holati:** `PARTIAL PASS` — integrity ✅, Defender ✅; VirusTotal ochiq.

---

## CT-10 — Download sahifasi va foydalanuvchi hujjatlari

**Vazifa:** rasmiy saytda installer uchun tushunarli va xavfsiz download oqimi tayyorlash.

**Goal:** foydalanuvchi eski console buildni emas, faqat tasdiqlangan professional installer’ni yuklab olishi.

**Qanday bajarish mumkin:**

1. Download sahifasida yagona `ChaqimchiAI Guard Setup.exe` havolasini ko‘rsatish.
2. Publisher, versiya, fayl hajmi, SHA-256 va release sanasini ko‘rsatish.
3. Windows 10/11 uchun qisqa o‘rnatish yo‘riqnomasini yozish.
4. Rozilik, QR/kod va finish oynalari uchun tasdiqlangan screenshotlar qo‘shish.
5. Unsigned MVP bo‘lsa SmartScreen ogohlantirishi haqida halol izoh yozish; himoyani o‘chirishni so‘ramaslik.
6. Privacy Policy, Terms, Support va Contact havolalarini tekshirish.
7. Eski installer URL’larini 404 yoki yangi download sahifasiga xavfsiz redirect qilish.

**Checkpoint CT-10:**

- [ ] Download tugmasi faqat tasdiqlangan final installerga olib boradi.
- [ ] Eski v1/v2/v3 fayllar public yuklab olinmaydi.
- [ ] Versiya va SHA-256 sahifada ko‘rsatilgan.
- [ ] O‘rnatish yo‘riqnomasi real test qilingan GUI’ga mos.
- [ ] Privacy, Terms, Support va Contact sahifalari ochiladi.
- [ ] Download HTTPS orqali ishlaydi.

**Done mezoni:** foydalanuvchi xavfsiz va chalkashliksiz final installer’ni topa oladi.

---

## CT-11 — Release candidate tasdiqlash

**Vazifa:** barcha checkpoint natijalarini bitta release qaroriga yig‘ish.

**Goal:** public release qilish yoki bloklash qarori dalillar asosida qabul qilinishi.

**Qanday bajarish mumkin:**

1. CT-01 dan CT-10 gacha natijalarni ko‘rib chiqish.
2. Kritik va yuqori darajadagi ochiq buglar yo‘qligini tekshirish.
3. Build hash, VirusTotal natijasi, Windows test natijalari va signing holatini release recordga biriktirish.
4. `GO`, `GO WITH KNOWN LIMITATIONS` yoki `NO-GO` qarorini yozish.
5. Known limitations bo‘lsa foydalanuvchiga ko‘rinadigan release notes’ga qo‘shish.

**Checkpoint CT-11:**

- [ ] CT-01–CT-10 kritik checkpointlari PASS.
- [ ] Critical/High ochiq bug yo‘q.
- [ ] Release artifact hash bilan muzlatilgan.
- [ ] Release notes tayyor.
- [ ] Yakuniy `GO/NO-GO` qarori yozilgan.

**Done mezoni:** faqat `GO` qaroridan keyin final artifact public release bosqichiga o‘tadi.

---

## CT-12 — Public release va post-release monitoring

**Vazifa:** tasdiqlangan buildni chiqarish va dastlabki foydalanuvchi muammolarini kuzatish.

**Goal:** foydalanuvchilar faqat tasdiqlangan installer’ni olishi va release muammolari tez aniqlanishi.

**Qanday bajarish mumkin:**

1. Final versiya va changelogni tasdiqlash.
2. Release tag yaratish.
3. Faqat `ChaqimchiAI Guard Setup.exe` va zarur SHA-256 sidecar’ni release asset sifatida joylash.
4. Download sahifasini yangi release’ga yo‘naltirish.
5. Release’dan keyingi dastlabki 24–48 soatda download, install, enrollment va support xatolarini kuzatish.
6. Kritik muammo chiqsa downloadni vaqtincha to‘xtatish va rollback/replace qarorini qabul qilish.

**Checkpoint CT-12:**

- [ ] Release asset nomi to‘g‘ri.
- [ ] Public hash final build bilan mos.
- [ ] Saytdagi download havolasi ishlaydi.
- [ ] Eski assetlar default download sifatida ko‘rinmaydi.
- [ ] 24 soatlik monitoring natijasi qayd etilgan.
- [ ] 48 soatlik monitoring natijasi qayd etilgan.

**Done mezoni:** release barqaror, download va enrollment oqimi ishlaydi, kritik regressiya aniqlanmagan.

---

## Bajarish tartibi

1. `CT-01` — domen va DNS
2. `CT-02` — production API konfiguratsiyasi
3. `CT-03` — Windows release muhiti
4. `CT-04` — versiya qarori
5. `CT-05` — full installer build
6. `CT-06` — Windows GUI/lifecycle test
7. `CT-07` — end-to-end enrollment va tracking
8. `CT-08` — security/signing
9. `CT-09` — Defender/VirusTotal/integrity
10. `CT-10` — download va hujjatlar
11. `CT-11` — GO/NO-GO
12. `CT-12` — public release va monitoring

## Hozirgi eng yaqin milestone

**Milestone M1 — Build Ready**

Quyidagilar bajarilganda M1 tugaydi:

- [ ] CT-01 PASS
- [ ] CT-02 PASS
- [ ] CT-03 PASS
- [ ] CT-04 PASS

M1’dan keyingi aniq ish: Windows release mashinasida `CT-05` bo‘yicha `ChaqimchiAI Guard Setup.exe` release candidate build qilish.
