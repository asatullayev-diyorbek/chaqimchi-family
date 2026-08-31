# Guard'ni boshqa Windows kompyuterda sinash

Bu — imzolanmagan MVP build (CT-08). SmartScreen ogohlantiradi; bu kutilgan.

## 1. Installer'ni olish

`windows-installer` workflow'ini ishga tushiring:

- GitHub -> **Actions** -> **windows-installer** -> **Run workflow**
- `version` (masalan `0.4.0-rc.2`) va `server_url` (default to'g'ri) ni qoldiring -> **Run**
- ~5 daqiqada tugaydi -> run sahifasidan **ChaqimchiAI-Guard-Setup-<version>** artifact'ini yuklab oling
- Ichida `ChaqimchiAI Guard Setup.exe` + `.sha256`

Yoki `git tag v0.4.0-rc.2 && git push --tags` — build GitHub Release'ga ham ilinadi.

## 2. Do'stingizga yuborish

`.exe` ni yuboring. Uni ochganda:

1. **"Windows protected your PC"** -> **More info** -> **Run anyway**
   (imzo yo'q — bu normal, Defender/SmartScreen'ni o'chirish shart emas)
2. UAC -> **Ha** (installer administrator huquqini so'raydi)
3. **Shaffoflik va rozilik** oynasi — nima kuzatilishi yozilgan, "O'qidim" -> **Davom etish**
4. **6 xonali kod** (yoki QR) ko'rsatiladi — kod 10 daqiqa amal qiladi

## 3. Siz — qurilmani bog'lash

Kod ekranda turganda:

- Vercel'dagi parent-web'ga kiring
- **Qurilmalar** -> **Qurilma qo'shish** -> 6 xonali kodni kiriting
- Bog'langach installer o'zi service'ni o'rnatadi va ishga tushiradi

Bir necha daqiqadan so'ng **Faoliyat** sahifasida ilova ishlatilishi ko'rina boshlaydi
(do'stingiz kompyuterda biror narsa qilib tursin).

## 4. O'chirish

Windows -> **Ilovalar va imkoniyatlar** -> **ChaqimchiAI Guard** -> **Uninstall**.
Service, `C:\Program Files\ChaqimchiAI`, `C:\ProgramData\ChaqimchiFamily` — hammasi tozalanadi.

## Nima sinalmagan (birinchi marta shu testda tekshiriladi)

- **Toza o'rnatish** — ilgari faqat hotswap sinalgan (CT-06)
- **Windows 10** — faqat Windows 11'da sinalgan
- **Reboot'dan keyin autostart**
- **OTA update** va **ilova ikonkalarini ajratish** — real qurilmada hech qachon ishlamagan

Nosozlik bo'lsa: `C:\ProgramData\ChaqimchiFamily\` dagi `.db` fayllar va Event Viewer ->
Windows Logs -> Application dagi `ChaqimchiFamilyAgent` yozuvlari yordam beradi.
