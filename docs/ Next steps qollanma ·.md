# Next Steps — To'liq bajarish yo'riqnomasi

Sana: 2026-08-11

Quyida har bir qadamni qanday amalga oshirish kerakligi batafsil yozilgan.

---

## 1. Eski `chaqimchi-installer-v1/v2/v3.exe` fayllarini olib tashlash / deprecated deb belgilash

**Nima uchun:** Bu fayllar console subsystem bilan build qilingan, GUI ochilmaydi. Foydalanuvchi tasodifan shularni yuklab olmasligi kerak.

**Qanday qilish:**
1. Repo/release joylashuvini tekshiring: `releases/windows/` papkasida ular hali turibdimi?
2. Agar GitHub Releases orqali tarqatilgan bo'lsa:
   - Har bir eski release'ni oching → "Edit release" → sarlavhaga `[DEPRECATED — GUI ishlamaydi]` deb qo'shing.
   - Yoki to'g'ridan-to'g'ri "Delete asset" qilib `.exe` faylni release'dan o'chiring (release yozuvini o'zini o'chirmasdan).
3. Agar saytda to'g'ridan-to'g'ri havola bo'lsa (masalan `chaqimchi-ai.uz/download`), o'sha havolani yangi build bilan almashtirguncha vaqtincha o'chirib qo'ying yoki "Tez orada yangilanadi" degan xabar bilan almashtiring.
4. Repo ichida fayllarni butunlay o'chirmang — arxiv sifatida `releases/windows/archive/` papkasiga ko'chiring, shunda tarix saqlanadi:
   ```bash
   mkdir -p releases/windows/archive
   git mv releases/windows/chaqimchi-installer-v1.exe releases/windows/archive/
   git mv releases/windows/chaqimchi-installer-v2.exe releases/windows/archive/
   git mv releases/windows/chaqimchi-installer-v3.exe releases/windows/archive/
   git commit -m "chore: move deprecated console-subsystem installers to archive"
   ```

---

## 2. To'liq public installer (`ChaqimchiAI Guard Setup.exe`)ni Inno Setup orqali qayta build qilish

**Nima uchun:** Hozirgi `ChaqimchiAI-Guard-Installer-GUI.exe` faqat bootstrap test build — asosiy public installer alohida Inno Setup skripti orqali yig'iladi.

**Qanday qilish (Windows 10/11 kompyuterda):**
1. Inno Setup (masalan 6.x) o'rnatilganligiga ishonch hosil qiling: https://jrsoftware.org/isinfo.php
2. Avval yangi GUI subsystem'li Go binary'ni build qiling:
   ```powershell
   $env:GOOS="windows"
   $env:GOARCH="amd64"
   go build -ldflags="-H=windowsgui" -o build\ChaqimchiAI-Guard-Installer.exe ./cmd/installer
   ```
3. Loyihadagi `.iss` skriptni toping (masalan `scripts/windows/setup.iss`) va undagi `Source:` yo'lini yangi binary'ga ko'rsating.
4. Inno Setup Compiler (ISCC.exe) orqali compile qiling:
   ```powershell
   & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" scripts\windows\setup.iss
   ```
5. Natijada `Output\ChaqimchiAI Guard Setup.exe` hosil bo'ladi — buni `releases/windows/` papkasiga ko'chiring.
6. Faylni `file` yoki `Get-ItemProperty` bilan tekshiring, GUI subsystem ekanini tasdiqlang (4-qadamga qarang).

---

## 3. `Assert-GuiExecutable` tekshiruvini shu build jarayonida ishga tushirish

**Nima uchun:** Yangi Inno Setup orqali yig'ilgan `.exe` ham xato subsystem bilan chiqib ketmasligini kafolatlash kerak.

**Qanday qilish:**
1. `scripts/windows/build-guard-setup.ps1` skriptini oching.
2. Inno Setup compile qadamidan **keyin**, natija faylga nisbatan `Assert-GuiExecutable` chaqiruvini qo'shing (agar hali qo'shilmagan bo'lsa):
   ```powershell
   Assert-GuiExecutable -Path "releases\windows\ChaqimchiAI Guard Setup.exe"
   ```
3. Skriptni to'liq ishga tushiring:
   ```powershell
   .\scripts\windows\build-guard-setup.ps1
   ```
4. Agar tekshiruv xato bersa (ya'ni console subsystem aniqlansa), skript **to'xtashi** va aniq xato xabarini chiqarishi kerak — buni qo'lda simulyatsiya qilib ko'ring (masalan vaqtincha `-H=windowsgui` flagini olib tashlab), gate ishlashini tasdiqlang.
5. Muvaffaqiyatli o'tsa, natijani (`PASS`) build log'iga yozib qo'ying.

---

## 4. Versiya raqami berish (v4) va `CHANGELOG.md`ni yangilash

**Qanday qilish:**
1. Versiyalash sxemasini aniqlang (semver: `v4.0.0` yoki oddiy `v4`).
2. Kodda versiya belgilangan joyni yangilang (masalan `internal/version/version.go` yoki `.iss` faylidagi `AppVersion`):
   ```
   #define MyAppVersion "4.0.0"
   ```
3. `CHANGELOG.md` fayliga yangi bo'lim qo'shing:
   ```markdown
   ## [4.0.0] - 2026-08-11
   ### Fixed
   - Installer endi GUI subsystem bilan build qilinadi (oldingi v1-v3 console subsystem xatosi tuzatildi).
   ### Added
   - `Assert-GuiExecutable` release gate skriptga qo'shildi.
   ```
4. Git tag qo'ying:
   ```bash
   git tag -a v4.0.0 -m "GUI installer fix"
   git push origin v4.0.0
   ```

---

## 5. Code signing sertifikatini tayyorlash va installer'ni imzolash

**Nima uchun:** Imzolanmagan `.exe` Windows SmartScreen tomonidan "noma'lum noshir" deb bloklanadi.

**Qanday qilish:**
1. Agar sertifikat hali yo'q bo'lsa — ishonchli CA'dan (DigiCert, Sectigo, SSL.com va h.k.) Code Signing sertifikat oling (OV yoki EV, EV tezroq reputatsiya to'playdi).
2. Sertifikat `.pfx` formatida bo'lsa, `signtool` bilan imzolang:
   ```powershell
   signtool sign /f "cert.pfx" /p "PAROL" /fd sha256 /tr http://timestamp.digicert.com /td sha256 "releases\windows\ChaqimchiAI Guard Setup.exe"
   ```
3. Agar HSM/token asosidagi sertifikat bo'lsa (masalan EV), `signtool` o'rniga tegishli provayder vositasidan foydalaning.
4. Imzoni tekshiring:
   ```powershell
   signtool verify /pa "releases\windows\ChaqimchiAI Guard Setup.exe"
   ```
5. Imzolash jarayonini ham `build-guard-setup.ps1` ichiga avtomatlashtirib qo'yish tavsiya qilinadi (CI/CD'da secret sifatida saqlab).

---

## 6. Real Windows 10/11 kompyuterda to'liq GUI oqimini qo'lda sinovdan o'tkazish

Bu allaqachon hujjatingizdagi **"Release oldidan tekshiruv"** checklist bilan mos keladi. Amaliy tartib:

1. Toza Windows 10 va Windows 11 virtual mashina (yoki jismoniy kompyuter) tayyorlang — avvalgi test qoldiqlarisiz.
2. Imzolangan `ChaqimchiAI Guard Setup.exe`ni yuklab/nusxalab oling va ishga tushiring.
3. Tekshirish ketma-ketligi:
   - [ ] Installer oynasi (GUI) muammosiz ochiladimi?
   - [ ] Shaffoflik va rozilik oynasi to'g'ri matn/tugmalar bilan chiqadimi, "Rozi bo'lish" bosilganda keyingi qadamga o'tadimi?
   - [ ] QR-kod va 6 xonali kod oynasi to'g'ri render bo'ladimi (QR skanerlanadimi, kod o'qilishi qulaymi)?
   - [ ] Ota-ona ilovasi orqali bog‘lashni sinab ko'ring — `api.chaqimchi-ai.uz` bilan real enrollment ishlaydimi (tarmoq so'rovlari muvaffaqiyatli qaytadimi)?
   - [ ] Windows Service to'g'ri o'rnatiladimi (`services.msc` orqali tekshiring, status "Running" bo'lishi kerak)?
   - [ ] Xatolik holatlarini sun'iy ravishda keltirib chiqarib (masalan internetni o'chirib), MessageBox to'g'ri chiqishini tekshiring.
4. Har bir bandni ✅/❌ bilan belgilab, muammo topilsa skrinshot va log biriktirib qaytadan dasturchiga yuboring.

---

## 7. VirusTotal va Windows Defender SmartScreen natijalarini tekshirish

**Qanday qilish:**
1. Imzolangan yakuniy `.exe`ni https://www.virustotal.com ga yuklang (yoki API orqali avtomatlashtiring).
2. Natijani ko'rib chiqing — agar 1-2 ta kichik antivirus false-positive bersa, odatda muammo emas, lekin 5+ ta aniqlasa, kodni qayta ko'rib chiqish kerak.
3. SmartScreen reputatsiyasini tekshirish uchun faylni toza Windows mashinada ishga tushiring — agar "Windows protected your PC" ogohlantirishi chiqsa, bu yangi imzo hali reputatsiya to'plamaganini bildiradi (vaqt bilan yoki EV sertifikat bilan tezroq o'tadi).
4. Agar antivirus false-positive bersa, tegishli vendor'ga (masalan Microsoft Defender uchun https://www.microsoft.com/wdsi/filesubmission) faylni "false positive" sifatida yuboring.

---

## 8. Release notes va foydalanuvchi hujjatlarini (o'rnatish qo'llanmasi) yangilash

**Qanday qilish:**
1. `CHANGELOG.md`dagi yozuvga asoslanib, foydalanuvchiga qaratilgan sodda release notes yozing (texnik jargonsiz):
   - Nima tuzatildi (masalan: "Endi o'rnatuvchi oyna to'g'ri ochiladi").
   - Yangilash uchun nima qilish kerak (masalan: "Eski versiyani o'chirib, yangisini qayta o'rnating").
2. Sayt/hujjatlardagi o'rnatish qo'llanmasini (agar skrinshotlar bo'lsa) yangi GUI oqimiga mos skrinshotlar bilan yangilang.
3. Agar FAQ yoki qo'llab-quvvatlash sahifasida "installer ishlamayapti" degan bo'lim bo'lsa, uni yangilang yoki olib tashlang.

---

## 9. Tasdiqlangan buildni public release sifatida chiqarish

**Qanday qilish:**
1. GitHub'da yangi release yarating:
   ```bash
   gh release create v4.0.0 "releases/windows/ChaqimchiAI Guard Setup.exe" \
     --title "ChaqimchiAI Guard v4.0.0" \
     --notes-file CHANGELOG.md
   ```
2. Agar sayt orqali tarqatilsa, download havolasini yangi faylga yo'naltiring va eski havolalarni (agar hali arxivlanmagan bo'lsa) o'chiring.
3. Chiqarishdan keyin 24-48 soat ichida foydalanuvchi fikr-mulohazalarini kuzatib boring (support so'rovlari, GitHub issues).
4. Muammo chiqmasa, eski `v1/v2/v3` fayllarini repo arxividan ham butunlay o'chirib tashlashingiz mumkin (ixtiyoriy, keyingi tozalash sikli uchun).

---

### Umumiy ketma-ketlik (qisqacha)

1. Eski buildlarni belgilash/arxivlash
2. Inno Setup orqali yangi installer yig'ish
3. `Assert-GuiExecutable` bilan tekshirish
4. Versiya + changelog
5. Imzolash
6. Windows 10/11'da qo'lda test
7. VirusTotal/SmartScreen tekshiruvi
8. Hujjat/release notes yangilash
9. Public release chiqarish