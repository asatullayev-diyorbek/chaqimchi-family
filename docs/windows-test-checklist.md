# Windows tekshiruv ro'yxati — 2026-09-01 sessiya ishi

Bu sessiyada juda katta hajmda kod yozildi va **hech biri real Windows'da
ishga tushirilmagan**. Quyida xavf darajasi bo'yicha tartiblangan tekshiruv.
Har bandni bajarib, natijani shu faylga yozib boring.

Windows mashina muhiti (2026-09-02, tekshirilgan): Go `C:\Program Files\Go`
(1.27.0), `goversioninfo.exe` `C:\Users\Robbit\go\bin`, ISCC
`C:\Users\Robbit\InnoSetup6\ISCC.exe`, WebView2 runtime bor. `pwsh` (PS7) yo'q —
build script'ni Windows PowerShell 5.1 uchun tuzatish kerak edi (BOM).

---

## Natijalar — 2026-09-02 (rc.5, real Windows 11)

**PASS:**

- **§0 build:** `build-guard-setup.ps1 -Version 0.4.0-rc.5` real Windows'da
  xatosiz. 3 EXE + Inno `Setup.exe` (27.8 MB, GUI subsystem, packer yo'q).
  Script PS 5.1 uchun tuzatildi (commit `e5b5199`): UTF-8 BOM + BOM'siz
  `release.json` yozuvi. SHA-256 `BE542742…` (Inno chiqishi reproducible emas —
  har build yangi hash).
- **§1 uitest oynalari:** `welcome/consent/existing/childstatus/complete/adult/
  block/blockapp` (walk) + `webinstaller` (WebView2) + yangi `blockcycle` —
  hammasi to'g'ri render bo'ldi. WebView2 v151 ishlaydi. UI bug topilmadi
  (dastlabki "blok sarlavhasi kesilgan" signal — DPI-unaware screenshot xatosi).
- **§2 (qisman) — toza o'rnatish:** Defender `Setup.exe`ni karantin qilgani
  uchun (pastga qarang) Inno wizard **o'rniga** test-zip'dagi standalone
  `ChaqimchiAI Guard Installer.exe` (bootstrap) ishlatildi:
  - WebView2 oqimi (Xush kelibsiz → Rozilik → Bog'lash) — **muammosiz** (real
    foydalanuvchi tasdiqi).
  - QR-kod + 6 xonali kod — **ikkalasi ham ishladi**, qurilma ulandi
    (`2ab0ea28-…`, `avval ulangan=false`).
  - `existing: installed=false` (mashina haqiqatan toza edi).
  - `19:01:00` xizmat o'rnatildi va ishga tushdi: `ChaqimchiFamilyAgent`
    **Running · Automatic · LocalSystem**, to'g'ri arglar, production API.
  - Session helper (PID Session 1) barqaror, yetim jarayon yo'q.
- **Tracking E2E (real):** helper foreground app'lar + ikonkalarni yubordi
  (`WindowsTerminal.exe`, `explorer.exe`, …) → `POST /api/tracking/ingest/`
  `saved=3/1/3`, `synced`, ikonkalar backend'da. `buffer.db`/`rules.db` yozildi.

**HALI SINALMAGAN:**

- **§2 Inno-ga xos:** `PrepareToInstall` (WebView2 gate), Start Menu yorlig'i
  (Bug #6), Settings → Apps yozuvi, `{commonstartup}` yorlig'i — bularning
  hammasi Inno `Setup.exe`da, u esa hozir Defender'da (pastga qarang).
- **§3 reboot autostart (Bug #6)** — bajarilmadi.
- **§4 re-install (Yangilash / Qayta bog'lash)** — bajarilmadi.
- **§5 tray + parent alert + BLOK EKRANI** — bajarilmadi. `ChaqimchiAI Guard
  Desktop.exe` (tray) ishga tushirilmagan; blok overlay (rc.5 yangi kodi,
  commit `18e4198`) real xizmat bilan hali sinalmagan. Faqat `uitest
  -screen blockcycle` bilan tasdiqlangan.
- **§6 uninstall** — test-zip'da Inno uninstaller yo'q; qo'lda tozalash ishladi
  (`sc delete` + papkalar + registry — `chaqimchi-cleanup-admin.ps1`).

### ⚠️ CT-09 BLOKER — Windows Defender false-positive

`releases/windows/ChaqimchiAI Guard Setup.exe` (rc.4 va rc.5, Inno bilan
yig'ilgan) Windows Defender cloud ML tomonidan **`Trojan:Win32/Wacatac.C!ml`**
(Severity: Severe) deb aniqlanadi va **ko'rish bilan o'chiriladi**:

- `releases/windows/…Setup.exe` — build'dan ~48 daq keyin o'chirildi.
- `parent-web/public/downloads/ChaqimchiAI-Guard-Setup.exe` (push qilingan,
  Vercel serve qiladi) — lokal bloklangan; saytdan yuklab olgan foydalanuvchi
  ham (`webfile:` resource, `https://guard.chaqimchi-ai.uz/downloads/…`).

Muhim: Defender **signature versiyasi rc.1 toza o'tган versiya bilan bir xil**
(`1.457.286.0`). Farq — faylning o'zi: rc.4/rc.5 ancha ko'proq kod
(`go-webview2` winloader, OTA updater binary-swap, `CreateProcessAsUser` session
helper, `killStrayReporters`). `!ml` = cloud evristik false-positive, aynan
CT-09'da bashorat qilingan ("Go-specific: Wacatac").

Ichki 3 EXE (`agent/build/*.exe`) Defender'da **toza** — faqat Inno-o'rami
flaglanadi. Shu sabab test-zip (`ChaqimchiAI-Guard-test-rc5.zip`) yasaldi.

**Ochiq qaror (foydalanuvchi keyinga qoldirdi):** code signing (CT-08) / Microsoft
WDSI false-positive submission + VirusTotal / triggerni kamaytirish (WebView2
bootstrapper embed'siz build sinash). CT-09 holati: **BLOCKED**.

---

## 0-alt. Tez yo'l — Wine-siz test build (Inno o'ramisiz)

macOS'da cross-compile qilingan 3 EXE:
`releases/windows/test-builds/ChaqimchiAI-Guard-test-0.4.0-rc.3-nowine.zip`
(gitignore'da — Mac'dan Windows'ga qo'lda ko'chiring).
zip SHA-256: `05A890C7168330A43502BD2908EF9CB25C33C1813A35E941BD9D347A198A6EB4`

- `ChaqimchiAI Guard Installer.exe` (Administrator) → butun WebView2 oqimi
  (§2 dagi Inno wizard qismisiz): Welcome → Consent → [Existing?] → Connect →
  Installing → Complete + xizmat o'rnatish
- `ChaqimchiAI Guard Desktop.exe` → tray + status/adult oynalari (§5)
- **Bu build'da yo'q:** Start Menu/Startup yorliqlari (⇒ §3 Bug #6 tekshirib
  bo'lmaydi), WebView2 runtime avto-o'rnatish (Win11 kerak yoki walk fallback
  ko'riladi), Apps&Features uninstall yozuvi.
- To'liq `Setup.exe` (§3, §6 uchun) baribir quyidagi to'liq build'ni talab qiladi.

## 0. Sync + build (to'liq — Setup.exe)

```powershell
git pull
cd agent
go test ./internal/...                    # webwin/qrcode/service/... kompilyatsiya + unit testlar
.\..\scripts\windows\build-guard-setup.ps1 -Version 0.4.0-rc.3 `
  -ISCC "C:\Users\Robbit\InnoSetup6\ISCC.exe" `
  -GoVersionInfo "C:\Users\Robbit\go\bin\goversioninfo.exe"
```

Nimani tasdiqlaydi:
- [ ] 3 EXE (agent, installer, desktop) real Windows'da build bo'ladi (`go-webview2` bilan)
- [ ] WebView2 Evergreen Bootstrapper `go.microsoft.com/fwlink/p/?LinkId=2124703` dan yuklandi (~2 MB)
- [ ] `ISCC` yangi `.iss`ni xatosiz compile qildi — **`[Icons]`, `WebView2Present()`, `PrepareToInstall`, `#ifndef WebView2BootstrapPath`** Pascal sintaksisi to'g'ri
- [ ] `releases\windows\ChaqimchiAI Guard Setup.exe` hosil bo'ldi; yangi SHA-256 qayd etildi

---

## 1. UI oynalarini o'rnatishsiz ko'rish (`cmd/uitest`)

```powershell
go run ./cmd/uitest -screen webwelcome     # keyin: webconsent webconnect webexisting webcomplete weberror
go run ./cmd/uitest -screen childstatus    # keyin: adult existing block blockapp
```

WebView2 (installer oqimi):
- [ ] `webwelcome` — 960×620, chap "art" panel + gradient, Inter shrift, teal marka, tugmalar ishlaydi
- [ ] `webconsent` — shaffoflik jadvali, checkbox belgilanmaguncha "Davom etish" o'chiq
- [ ] `webconnect` — QR rasmi ko'rinadi, kod `482 913`, sanoq har soniya kamayadi; ~6s da "✓ bog'landi" → `installing.html`ga o'tadi → progress 4 bosqich → yopiladi
- [ ] `webexisting` — Yangilash / Qayta bog'lash / Bekor qilish
- [ ] `webcomplete` / `weberror` — matn, tugma

Native (walk / GDI):
- [ ] `childstatus` — walk status oynasi (WebView2 fallback emas, bu alohida yo'l)
- [ ] `block` — **amber** chip, `blockapp` — **ko'k** chip; fullscreen, yopib bo'lmaydi (8s da o'zi yopiladi)
- [ ] `adult` — ogohlantirish → panel

Agar WebView2 oyna **umuman ochilmasa** (bo'sh/oq): WebView2 runtime yo'q →
walk fallback ishga tushishi kerak. Buni ham qayd et.

---

## 2. Toza o'rnatish

Avval eski versiyani to'liq o'chir (Settings → Apps, yoki eski uninstaller).

```
releases\windows\ChaqimchiAI Guard Setup.exe   ← ishga tushir
```

- [ ] Inno wizard → `PrepareToInstall` (WebView2 tekshiruvi; Win11'da darhol o'tadi)
- [ ] `[Run]` bootstrap: **Xush kelibsiz → Rozilik → Bog'lash (QR/kod)** oynalari WebView2'da
- [ ] Ota-ona ilovasi/dashboard'dan kodni kiritib qurilmani bog'lash → **O'rnatilmoqda → Tayyor**
- [ ] `sc query ChaqimchiFamilyAgent` → `RUNNING`; `Automatic`
- [ ] **Bug #6:** Start menu → "ChaqimchiAI Guard" bor; tray belgisi ko'rinadi
- [ ] Settings → Apps → "ChaqimchiAI Guard" ro'yxatda (uninstall mumkin)

---

## 3. Reboot autostart (Bug #6 asosiy)

- [ ] Windows'ni **qayta ishga tushir**
- [ ] Kirgandan keyin tray belgisi **avtomatik qayta paydo bo'ladi** (`{commonstartup}` yorlig'i)
- [ ] Service hali `RUNNING`
- [ ] `app_usage` event'lar to'planishda davom etadi (bir nechta ilova ochib, dashboard'da tekshir)

---

## 4. Re-install xavfsizligi

O'rnatilgan + ishlab turgan holatda `Setup.exe`ni **qayta** ishga tushir:
- [ ] "Allaqachon o'rnatilgan" oynasi chiqadi (WebView2 yoki walk)
- [ ] **Yangilash** → xizmat to'xtaydi, binary almashadi, **o'sha qurilma** bilan qayta ishga tushadi (enrollment yo'q)
- [ ] (alohida test) **Qayta bog'lash** → yangi kod so'raladi
- [ ] Ishlab turgan agent ustidan yozishda "access denied" / yarim o'rnatma **yo'q**

---

## 5. Tray oynalari + parent alert (⚠️ backend deploy kerak)

**Old shart:** ✅ **BAJARILDI (2026-09-01)** — backend PA'ga deploy qilindi
(`apps/alerts` migration `0002` + `notifications.py` + `telegram.py`),
migratsiya qo'llandi, webapp reload, PA'da 8/8 alerts test PASS. WSGI'da
`TELEGRAM_BOT_TOKEN` bor — Telegram xabari ishlashi kerak.

- [ ] Tray → "Bugungi holat" — status oynasi jonli ma'lumot bilan (ekran vaqti, limit)
- [ ] Tray → "Nima kuzatiladi?" — shaffoflik oynasi
- [ ] Tray → "Kattalar uchun" → ogohlantirish → **Davom etish** → panel ochiladi
- [ ] Ota-ona dashboard'ida `settings_panel_access` alert paydo bo'ladi
- [ ] Telegram bot orqali ota-onaga xabar keladi (agar `telegram_id` ulangan bo'lsa)
- [ ] Paneldan "Yordam" → brauzer; "O'chirish" → Windows Apps sahifasi

---

## 6. Uninstall

- [ ] `unins000.exe` yoki Settings → Apps → o'chirish
- [ ] Service, `C:\Program Files\ChaqimchiAI`, `C:\ProgramData\ChaqimchiFamily`, **Start menu + Desktop + Startup yorliqlari** — hammasi tozalanadi
- [ ] Tray belgisi yo'qoladi (uninstall taskkill qiladi)

---

## Ma'lum cheklovlar / kutiladigan muammolar

- Sequential WebView2 oynalar (installer oqimi bitta jarayonda 5-6 oyna) —
  `go-webview2` buni qo'llab-quvvatlaydi, lekin real sinovda birinchi marta ko'riladi.
- Har WebView2 oyna alohida `msedgewebview2.exe` jarayon (bir necha MB RAM).
- SmartScreen installer'ni "unsigned" deb ogohlantiradi (CT-08 qarori).
- WebView2 runtime yo'q Win10'da bootstrapper internet talab qilishi mumkin.
