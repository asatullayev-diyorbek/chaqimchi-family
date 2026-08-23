# ChaqimchiAI Guard — Trust & Reputation Strategy

> Holati: **MVP/Beta uchun ustuvor siyosat**. Ushbu hujjat
> `windows-security-trust-guideline.md` va undan oldingi barcha hujjatlardagi
> zid release talablarini almashtiradi.

## Qaror

Code Signing Certificate MVP va Beta’da majburiy emas. Shu davrda SmartScreen
ogohlantirishini 100% yo‘qotish mumkin emas; mahsulot buni yashirmaydi hamda
himoyani o‘chirishni so‘ramaydi. Maqsad — professional, shaffof tarqatish va
antivirus false-positive holatlarini minimallashtirish.

## MVP/Beta release gate

Imzosiz build faqat quyidagilar bajarilganda chiqariladi:

1. Public download faqat professional installer orqali: WiX, Inno Setup yoki
   NSIS. ZIP ichidagi EXE yoki agent EXE alohida tarqatilmaydi.
2. Installer nomi barqaror: `ChaqimchiAI Guard Setup.exe` (yoki Family brendi
   yakuniy tanlangach unga mos yagona nom). `final`, `new`, `last`, tasodifiy
   versiyali fayl nomlari public download’da ishlatilmaydi.
3. Har EXE’da bo‘sh bo‘lmagan Windows metadata bo‘ladi: Product Name
   `ChaqimchiAI Guard`, Company `ChaqimchiAI`, Description `Parental Control
   Client`, Product/File Version va `https://chaqimchiai.uz` website.
4. Har EXE brend ikonkasiga ega; default Go/Windows icon ishlatilmaydi.
5. Installer Windows Service, monitoring kategoriyalari, startup, HTTPS va
   update holatini aniq ko‘rsatadi; consent olinadi. Silent/hidden install
   ishlatilmaydi.
6. Barcha production endpointlar faqat HTTPS: `api.chaqimchiai.uz`, update
   kanali `update.chaqimchiai.uz`. HTTP faqat local development uchun.
7. UPX yoki boshqa executable packer ishlatilmaydi.
8. Har release VirusTotal’dan o‘tadi. Maqsad 0–1 detection; ko‘p false
   positive bo‘lsa release to‘xtatiladi va tahlil qilinadi.
9. Rasmiy saytda Download, Documentation, Privacy Policy, Terms, Support va
   Contact sahifalari mavjud bo‘ladi.

## Nomlash va jarayonlar

- Windows Services’da display name: **ChaqimchiAI Guard Service**.
- Task Manager’da foydalanuvchi tushunadigan nomlar ishlatiladi:
  `ChaqimchiAI Guard`, `ChaqimchiAI Service`, `ChaqimchiAI Updater`.
- `system.exe`, `host.exe`, `service.exe`, `svhost.exe`, `update.exe` kabi
  nomlar qat’iyan taqiqlangan.
- Watchdog faqat Guard Service’ni 10–15 soniyada tekshiradi, qayta ishga
  tushirishni loglaydi va boshqa processlarga tegmaydi.

## Update siyosati

MVP’da unsigned self-updater o‘chiq qoladi. Yangilanish oqimi:

`version check → installer download → user confirmation → install → service restart`.

Updater EXE/DLL/memory’ni patch qilmaydi. Code signing joriy etilganda
Authenticode va hash verifikatsiyasi, rollback hamda foydalanuvchi tasdig‘i
bilan yoqiladi.

## Bosqichlar

| Bosqich | Talab |
| --- | --- |
| MVP | Professional installer, branding/metadata/icon, consent, Windows Service, HTTPS, VirusTotal |
| Beta (100+ foydalanuvchi) | Oddiy Code Signing Certificate |
| Stable (1000+ foydalanuvchi) | EV Code Signing Certificate va SmartScreen reputation |

## O‘zgarmas taqiqlar

DLL/process injection, memory patch, keyboard hook, rootkit/driver injection,
self-modifying executable, Defender/Firewall/UAC’ni o‘chirish, hidden process,
hidden startup va Explorer injection ishlatilmaydi.
