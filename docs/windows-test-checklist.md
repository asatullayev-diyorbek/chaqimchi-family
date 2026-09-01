# Windows tekshiruv ro'yxati — 2026-09-01 sessiya ishi

Bu sessiyada juda katta hajmda kod yozildi va **hech biri real Windows'da
ishga tushirilmagan**. Quyida xavf darajasi bo'yicha tartiblangan tekshiruv.
Har bandni bajarib, natijani shu faylga yozib boring.

Windows mashina muhiti (memory'dan): Go `C:\Users\Robbit\gosdk`,
`goversioninfo.exe` `C:\Users\Robbit\go\bin`, ISCC `C:\Users\Robbit\InnoSetup6\ISCC.exe`.

---

## 0. Sync + build

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

**Old shart:** backend PythonAnywhere'ga deploy qilingan bo'lishi kerak
(`apps/alerts` migration `0002` + `notifications.py` + `telegram.py`), aks
holda `settings_panel_access` alert 400 qaytaradi.

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
