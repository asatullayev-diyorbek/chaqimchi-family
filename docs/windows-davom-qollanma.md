# Windows'da davom etish — qo'llanma

Sana: 2026-09-02. Muallif eslatmasi: shu paytgacha barcha kod macOS'da yozilgan
va cross-compile qilingan. **To'liq `Setup.exe` (Inno Setup o'rami, Start Menu /
Startup yorliqlari, uninstaller) faqat Windows mashinada yig'iladi.** Quyida
Windows'ga o'tgach nima qilish kerakligi tartib bilan.

GitHub repo: `https://github.com/asatullayev-diyorbek/chaqimchi-family`
`main` shoxobchasi eng oxirgi holat (`2a22bbd` — test build #7 / rc.4).

---

## 0. Muhitni tayyorlash (bir marta)

| Vosita | O'rnatish | Tekshirish |
|---|---|---|
| **Git** | git-scm.com | `git --version` |
| **Go** (≥ 1.23) | go.dev/dl | `go version` |
| **Inno Setup 6** | jrsoftware.org/isdl.php | `iscc.exe` PATH'da yoki yo'lini eslab qol |
| **goversioninfo** | `go install github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest` | `%USERPROFILE%\go\bin\goversioninfo.exe` mavjud |
| **WebView2 Runtime** | Windows 11'da bor; Win10 uchun build vaqtida bootstrapper yuklab olinadi | — |

Memory'dagi eski mashina yo'llari (agar o'sha mashina bo'lsa):
Go `C:\Users\Robbit\gosdk`, `goversioninfo.exe` `C:\Users\Robbit\go\bin`,
ISCC `C:\Users\Robbit\InnoSetup6\ISCC.exe`.

---

## 1. Reponi olish / yangilash

```powershell
git clone https://github.com/asatullayev-diyorbek/chaqimchi-family.git
cd chaqimchi-family
# yoki mavjud bo'lsa:
git pull
```

Kompilyatsiya + unit testlar (payload stub avtomatik build skriptida yaratiladi,
lekin qo'lda tekshirish uchun):

```powershell
cd agent
go test ./internal/...
```

Hammasi `ok` bo'lishi kerak (rules paketida P3a/P3b testlari ham bor).

---

## 2. Oynalarni o'rnatishsiz ko'rish (`cmd/uitest`)

Tez vizual tekshiruv — hech narsa o'rnatilmaydi:

```powershell
cd agent
go run ./cmd/uitest -screen webwelcome     # keyin: webconsent webconnect webexisting webcomplete weberror
go run ./cmd/uitest -screen childstatus    # keyin: adult existing block blockapp
```

Kutilgan natija `docs/windows-test-checklist.md` §1 da.

---

## 3. To'liq `Setup.exe` build qilish

```powershell
cd chaqimchi-family
powershell -ExecutionPolicy Bypass -File scripts\windows\build-guard-setup.ps1 `
  -Version 0.4.0-rc.4 `
  -ISCC "C:\Users\Robbit\InnoSetup6\ISCC.exe" `
  -GoVersionInfo "C:\Users\Robbit\go\bin\goversioninfo.exe"
```

Skript o'zi bajaradigan ishlar:
1. WebView2 Evergreen Bootstrapper'ni `go.microsoft.com/fwlink/p/?LinkId=2124703` dan yuklaydi
2. 3 ta EXE'ni build qiladi (`agent`, `installer` — ichida agent.exe embed, `desktop`)
3. Har biriga Windows version-metadata + icon qo'yadi (goversioninfo)
4. GUI subsystem tekshiruvidan o'tkazadi
5. ISCC bilan `chaqimchi-guard.iss` ni compile qiladi
6. Natija: `releases\windows\ChaqimchiAI Guard Setup.exe`
7. `parent-web\public\downloads\ChaqimchiAI-Guard-Setup.exe` + `release.json` ni yangilaydi

Natijani commit qilish (ixtiyoriy — bu fayl `.gitignore` da `releases/`, lekin
`parent-web/public/downloads/` **tracked**):

```powershell
git add parent-web/public/downloads/ChaqimchiAI-Guard-Setup.exe parent-web/src/app/download/release.json
git commit -m "Windows: Setup.exe rc.4 build"
git push
```

---

## 4. Real Windows'da test qilish

To'liq ro'yxat: **`docs/windows-test-checklist.md`** (§0–§6). Har bandni bajarib,
natijani o'sha faylga yozib bor.

Ustuvor (hali real Windows'da sinalmagan):

- **§2 Toza o'rnatish** — Inno wizard → WebView2 oqimi (Welcome → Rozilik →
  Bog'lash) → dashboard'dan kod → O'rnatilmoqda → Tayyor
- **§3 Reboot autostart** — qayta yuklashdan keyin tray + service qaytadi (Bug #6)
- **§4 Re-install** — ishlab turgan agent ustidan "Yangilash" / "Qayta bog'lash"
- **§5 Tray oynalari** — status, shaffoflik, "Kattalar uchun" → alert
- **§6 Uninstall** — service + papkalar + yorliqlar tozalanadi

### Yangi (build #7 / rc.4) — qoidalar enforcementi

Backend PA'ga deploy qilingan (2026-09-02), quyidagilar tekshirilsin:

1. **Hafta kuni / dam olish kuni limiti**
   Dashboard → Qoidalar → "Kunlik limit" + "Dam olish kunlari (Sh–Ya)" —
   ikkalasini kirit, saqla. Agent'da (`~5 daq` sinxronizatsiyadan keyin)
   Shanba/Yakshanba'da dam olish qiymati qo'llanishi kerak. Tez tekshirish uchun
   kompyuter soatini Shanbaga o'zgartirib ko'rish mumkin.
2. **Dam olish vaqti oynasi (`blocked_window`)**
   Dashboard → Qoidalar → "Dam olish vaqti" → hozirgi vaqtni qamrab oladigan
   oyna qo'sh (masalan hozir 14:00 bo'lsa `13:00–15:00`). ~5 daqiqada agent
   ekranни bloklashi + dashboard'da `limit_reached` (quiet_hours) alert paydo
   bo'lishi kerak.
   **Eslatma:** Windows service Session 0 da ishlaydi va hozircha blok ekranini
   **chizmaydi** (faqat log qiladi — `%ProgramData%` yoki service log). To'liq
   blok ekrani `cmd/desktop` helper orqali keladi — bu hali ulanmagan (pastdagi
   "Ochiq ishlar").

---

## 5. Agent OTA release chiqarish (yangi versiya tarqatish)

Mavjud o'rnatilgan agentlar avtomatik yangilanadi (Ed25519 imzo tekshiriladi).

```powershell
# gh CLI authenticated bo'lishi kerak; imzo kaliti agent/.secrets/update-signing.key
bash scripts/updates/publish-agent-release.sh 0.5.0
```

Keyin skript chop etgan ma'lumot bilan Django admin'da `AgentVersion` qatori
qo'shiladi: `/admin/deploy/agentversion/` — version, binary_url, sha256,
signature, `is_active=yes`. **Avval bitta test qurilmaga** chiqar, dashboard'da
`agent_version` yangilanganини ko'r, keyin hammага.

> Django admin PA'da: `https://apiguard.pythonanywhere.com/admin/`
> (yoki `https://api.guard.chaqimchi-ai.uz/admin/`).

---

## 6. Backend holati (macOS sessiyasida bajarilgan)

✅ **PA'ga deploy qilingan (2026-09-02):**
- Telegram bot P1–P5 (webhook, `/bugun /ogohlantirishlar /qurilmalar`, digest,
  notification preferences)
- Parol o'zgartirish / Telegram orqali tiklash
- `blocked_window` + hafta kuni limiti qoida sxemasi
- Migratsiyalar: `accounts/0005`, `rules/0002`, `tracking/0004`

⏳ **Qolgan (bir marta, brauzerda):** kunlik Telegram hisoboti uchun tashqi cron.
PA Free'da scheduled task yo'q → cron-job.org (yoki shунга o'xshash):
- URL: `POST https://api.guard.chaqimchi-ai.uz/api/tracking/digest/run/`
- Header: `X-Digest-Secret: RjREeVb4PGfXDvuZGoi3J9lEGMI4vTe9`
- Jadval: har kuni ~15:00 UTC (Toshkent 20:00)

PA deploy how-to (kelajakda backend o'zgarsa) — `memory/project_chaqimchi_architecture.md`
dagi "PA deploy how-to" bo'limida (token, console id, Files API).

---

## 7. Ochiq ishlar (keyingi kod)

`docs/parent-web-plan.md` va `docs/current_tasks.md` da to'liq. Qisqacha:

- **Blok ekranini `blocked_window` / `daily_limit` ga ulash** — Session 0
  service UI chizolmaydi; `cmd/desktop` helper'ga localipc buyruq kanali kerak
  (hozir enforcer faqat log qiladi). Bu eng muhim ochiq ish.
- **P3 vizual timeline** — qoidalar sahifasida vaqt oynalari uchun grafik ko'rinish
- **P4** — faoliyat: kategoriya-rangli grafik, maxsus sana oralig'i
- **P6** — Liquid Glass dizayn, responsive sidebar (<1024px), skeleton'lar

---

## 8. Tozalash buyruqlari (test orasida)

```powershell
sc stop ChaqimchiFamilyAgent
sc delete ChaqimchiFamilyAgent
Remove-Item -Recurse -Force "C:\Program Files\ChaqimchiAI"
Remove-Item -Recurse -Force "C:\ProgramData\ChaqimchiFamily"
# Wine-siz test build'da qo'lda; to'liq Setup.exe'da uninstaller o'zi qiladi
```

Installer logi (xato bo'lsa yuborish uchun):
`%TEMP%\chaqimchi-installer.log`

---

## 9. Ma'lum muammolar / kutiladigan holatlar

- **SmartScreen** installer'ni "unsigned" deb ogohlantiradi (CT-08 qarori —
  imzo sertifikati hali yo'q). "More info → Run anyway".
- **Sequential WebView2 oynalar** — installer oqimi bitta jarayonda bir necha
  oyna; `go-webview2` qo'llab-quvvatlaydi, real sinovda birinchi marta ko'riladi.
- **Win10 + WebView2 yo'q** — bootstrapper internet talab qiladi; bo'lmasa har
  oyna native walk dialogга tushadi (backstop, o'chirilmagan).
- GitHub Actions **billing-locked** — CI ishlamaydi, build qo'lda.
