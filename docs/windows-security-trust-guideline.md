# ChaqimchiAI Guard — Windows Security & Trust siyosati

> Holati: **asosiy mahsulot siyosati**. MVP/Beta’dagi code-signing va
> reputation qoidalari uchun [Trust & Reputation Strategy](windows-trust-reputation-strategy.md)
> ustuvor hisoblanadi. Qolgan xavfsizlik va shaffoflik talablari o‘z kuchida.

## Maqsad

ChaqimchiAI Guard Windows tomonidan foydalanuvchiga ko‘rinadigan, ruxsat bilan
ishlaydigan korporativ/parental-control dastur sifatida qabul qilinishi kerak.
U hech qachon Defender, Firewall, UAC yoki boshqa Windows himoyalarini
o‘chirishni so‘ramaydi va yashirin monitoring texnikalaridan foydalanmaydi.

## Qat’iy taqiqlar

Quyidagilar mahsulotda bo‘lmaydi: DLL/process/code injection, global keyboard
hook, memory patching, self-modifying yoki self-deleting executable, hidden
process, rootkit/driver orqali yashirin kuzatuv, Defender/Firewall/UAC’ni
o‘chirish, Explorer’ni patch qilish va yashirin registry o‘zgarishlari.

Faqat Microsoft hujjatlashtirgan Windows API’lari ishlatiladi: Windows Service,
Service Control Manager, Task Scheduler yoki Registry Run (faqat ko‘rsatilgan
va foydalanuvchi tasdiqlagan autostart uchun), Windows Notifications, Event Log
va WMI.

## Majburiy arxitektura

```
Desktop UI (login, QR/pairing, status, logs, settings)
                         │
                         ▼
ChaqimchiAI Guard Service (monitoring, sync, device status, rules)
                         │
                         ▼
Local database  ─────── HTTPS ─────── Backend API
                         ▲
                         │
Guard Watchdog / SCM failure recovery
```

- Desktop UI monitoringni bajarmaydi; u faqat foydalanuvchi bilan ochiq aloqa
  qatlami hisoblanadi.
- Service Windows Services ro‘yxatida **`ChaqimchiAI Guard Service`** display
  name’i bilan ko‘rinadi. Service uchun barqaror texnik identifier release
  oldidan belgilanadi.
- Service Session 0’da UI chizmaydi. UI kerak bo‘lsa, alohida user-session
  desktop helper orqali ko‘rsatiladi.
- Watchdog faqat Service holatini 10–15 soniyada tekshiradi, qayta ishga
  tushirishni loglaydi va boshqa monitoring qilmaydi. Windows SCM failure
  recovery asosiy qayta tiklash mexanizmi hisoblanadi.

## Consent va shaffoflik

Installer o‘rnatishdan oldin ko‘rinadigan oynada quyidagilarni aniq ko‘rsatadi:

- Windows Service va Auto Start;
- Device monitoring hamda ishlatiladigan aniq monitoring kategoriyalari;
- secure HTTPS connection;
- avtomatik update faqat rozilik bilan;
- administrator/UAC, notification, startup va network ruxsatlarining sababi.

Silent install va yashirin ruxsat olish public release’da taqiqlanadi. Har bir
monitoring kategoriyasi Settings’da yoqilgan/o‘chiq holati hamda tushuntirishi
bilan ko‘rinadi: Browser Activity, Installed Apps, Screen Time, Device Status,
Notifications. Quyidagi holatlar loglanadi: Service Started, Sync Completed,
Rules Updated, Connection Lost, Watchdog Restart va Device Paired.

## Tarqatish, imzo va update

1. Public release faqat professional installer (`.msi`, Inno Setup yoki WiX;
   NSIS ham mumkin) orqali beriladi. ZIP ichidagi yalang‘och EXE tarqatilmaydi.
2. Code signing mavjud bo‘lgach installer, service executable va update
   paketlari bitta tasdiqlangan
   publisher identity bilan SHA-256 hamda RFC 3161 timestamp yordamida
   imzolanadi. EV certificate ideal; Microsoft Trusted Signing yoki ishonchli
   CA sertifikati ham qabul qilinadi.
3. Sertifikat/PFX repoga, `.env`ga, release papkasiga yoki loglarga kirmaydi.
   Imzo `signtool verify /pa` bilan release manifestda qayd etiladi.
4. Yuklab olish va update faqat kompaniyaning barqaror HTTPS domenidan amalga
   oshadi. Update manifest versiya, URL, SHA-256, publisher/signature holati va
   release note’ni beradi.
5. Agent yangi buildni o‘rnatishdan oldin uning Authenticode imzosini va hashini
   tekshiradi. Foydalanuvchi update’ga rozilik beradi; rollback ham imzolangan
   oldingi paket bilan ishlaydi.
6. Har release VirusTotal’da tekshiriladi. Maqsad 0–1 detection; 8 yoki undan
   ko‘p detection release bloklanadi va false-positive bo‘lsa Microsoft
   Security Intelligence portaliga yuboriladi.

## Hozirgi kod bazasidan kelib chiqqan qarorlar

| Yo‘nalish | Hozirgi holat | Release oldi qaror |
| --- | --- | --- |
| Service | `internal/service` hujjatlashtirilgan SCM API va failure recovery ishlatadi | Real Windows’da manual test; display name’ni `ChaqimchiAI Guard Service`ga o‘tkazish |
| Installer | Bitta EXE agent payloadini joylaydi, ammo QR/holat console’da | Professional GUI installer va aniq consent oynasi bilan almashtirish |
| Consent | `-accept-privacy` development flag’i bor | Public build’da silent/flag orqali chetlab o‘tish bo‘lmaydi |
| Updater | Hozirgi development updater imzo tekshirmaydi | Public kanalga ulash taqiqlanadi; Authenticode+hash+consent+rollback qo‘shilgachgina yoqiladi |
| Watchdog | SCM recovery mavjud | Alohida watchdog faqat holat/log talab qilinganda, yashirin persistensiyasiz qo‘shiladi |
| Uninstall | Eski dizayn hujjatida oddiy uninstall’ni cheklash fikri bor | Bekor qilinadi: standart Windows uninstall ko‘rinadigan va ishlaydigan bo‘lishi kerak |

## Release gate

MVP/Beta release uchun aniq gate’lar [Trust & Reputation Strategy](windows-trust-reputation-strategy.md)
da berilgan. Imzo mavjud bo‘lgach signed installer va agent, imzo
verifikatsiyasi, professional consent UI, Windows 10/11 clean-machine
o‘rnatish testi, Services/Event Viewer/Apps list ko‘rinishi, HTTPS update
integrity testi, VirusTotal tekshiruvi va privacy/monitoring settings review
majburiy bo‘ladi.

Qo‘shimcha amaliy tartib uchun [windows-distribution.md](windows-distribution.md)
saqlanadi; u ushbu siyosatga mos bo‘lishi shart.
