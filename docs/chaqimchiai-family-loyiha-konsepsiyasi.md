# ChaqimchiAI Family — Yagona Loyiha Konsepsiyasi

> Ushbu hujjat mahsulotning yangilangan asosiy manbasi: parent va child interfeyslari, texnik komponentlar, dizayn tili, ma'lumot chegaralari hamda rivojlanish tartibini birlashtiradi. Avvalgi bosqich va dizayn hujjatlari bu konsepsiyani batafsil to'ldiradi; ziddiyat bo'lsa, shu hujjatdagi yo'nalish ustun turadi.

## 1. Mahsulot g'oyasi

**ChaqimchiAI Family** — oilalarga bola kompyuteridan foydalanish bo'yicha ochiq kelishilgan qoidalarni boshqarishga yordam beradigan vosita. Bu yashirin kuzatuv yoki jazolash mahsuloti emas.

Mahsulotning uchta teng muhim va'dasi bor:

1. **Shaffoflik:** bola agent mavjudligini, qanday ma'lumot olinishi va qoidalar nima ekanini ko'radi.
2. **Xotirjam boshqaruv:** ota-ona tezkor holatni va qoidalarni oddiy tilda boshqaradi.
3. **Offline barqarorlik:** qoidalar hamda hisoblash lokal agentda ishlaydi; tarmoq bo'lmasa ham bola tajribasi buzilmaydi.

## 2. Foydalanuvchilar va mahsulot qatlamlari

| Qatlam | Foydalanuvchi | Vazifa | Asosiy interfeys |
|---|---|---|---|
| Parent | Ota-ona | Holatni ko'rish, qoidalarni boshqarish, alertlarni ko'rish | Web va mobile panel |
| Child | Bola | Ekran vaqti/qoidani ko'rish, nima kuzatilishini tushunish | Windows tray, status oyna, block screen |
| Installer | Ota-ona/kattalar | Rozilik, qurilmani oilaga bog'lash va agentni o'rnatish | Windows installer wizard |
| Server | Tizim | Tenant ajratish, ma'lumot/qoidalarni uzatish | Django API + Channels |

## 3. Birlashtirilgan dizayn tizimi

Barcha qatlamlar bitta brend tizimidan foydalanadi:

- **Material:** Liquid Glass — yarim shaffof qatlam, blur, nozik oq chegara va yumshoq ko'k soya.
- **Asosiy rang:** ko'k (`#2563eb`), yengil ko'k (`#60a5fa`).
- **Ijobiy holat:** teal/yashil-ko'k; **ehtiyotkor ogohlantirish:** amber; qizil faqat haqiqiy xavfli/destruktiv amallar uchun.
- **Tipografiya:** `Inter` — ota-ona web paneli va Child installer/desktop dizayni uchun yagona shrift.
- **Shakl:** katta yumaloq radiuslar, sokin bo'sh joy, o'qish oson kontrast.

Child qatlamida shu tizim saqlanadi, lekin boshqaruv elementlari ataylab kamaytiriladi: bola ko'radi, ammo qoida o'zgartirmaydi.

## 4. Repozitoriy va interfeys manbalari

```text
server/          Django API, real ma'lumotlar va autentifikatsiya
agent/           Windows Go service, buffer/sync, rule enforcement, tray/block UI
parent-mobile/   Expo mobil ota-ona ilovasi
parent-web/      Next.js real web ota-ona paneli
parent-ui/       Parent web panelining statik HTML/CSS vizual prototipi
child-ui/        ChaqimchiAI Child va installerning statik HTML/CSS dizayn manbasi
docs/            Arxitektura, UX va mahsulot konsepsiyasi
```

`parent-ui/` va `child-ui/` production ilova emas. Ular komponent, layout, matn va holatlarni `parent-web`, `parent-mobile` yoki Windows agent UI'ga o'tkazish uchun dizayn manbalari hisoblanadi.

## 5. Parent tajribasi

### 5.1. Asosiy savollar

Ota-ona har ochganda quyidagi savollarga tez javob olishi kerak:

1. Qurilma hozir onlaynmi?
2. Bugun qancha ekran vaqti ishlatildi?
3. Eng ko'p qaysi ilovalar ishlatildi?
4. Muhim alert bormi?
5. Limit yoki cheklovni qanday o'zgartiraman?

### 5.2. Parent web ma'lumot arxitekturasi

```text
Login / Signup
  └─ Shaffoflik tushuntirishi
Overview
  ├─ Activity
  ├─ Alerts
  ├─ Rules
  ├─ Devices
  └─ Settings
```

Har parent sahifasi bitta asosiy savolga javob beradi. Dashboard faqat API'da mavjud ma'lumotni real ko'rinishda beradi; “AI ball”, kategoriyalash, PDF/CSV hisobotlar, billing, SMS/2FA yoki remote-control kabi hali qo'llab-quvvatlanmagan funksiyalar demo sifatida ko'rsatilmaydi.

### 5.3. Parent qurilma tanlovi

Barcha `Overview`, `Activity`, `Rules` va `Alerts` ekranlarida bitta umumiy device/child selector ishlaydi. Tanlov URL query orqali saqlanadi (`?device=<uuid>`), shuning uchun refresh va ulashish holati buzilmaydi.

## 6. ChaqimchiAI Child tajribasi

Child ilova boshqaruv paneli emas — bolaning qoidalar va monitoring haqida xabardor bo'lishi uchun minimal desktop qatlam.

### 6.1. Installer oqimi

| Qadam | Dizayn fayli | Foydalanuvchi vazifasi |
|---|---|---|
| Xush kelibsiz | `child-ui/welcome.html` | O'rnatish maqsadini tushunish |
| Shaffoflik va rozilik | `child-ui/consent.html` | Nima ko'rilishi/ko'rilmasligini o'qish va tasdiqlash |
| Oilaga bog'lash | `child-ui/connect.html` | QR yoki 6 xonali kod bilan parent hisobiga bog'lash |
| O'rnatish | `child-ui/installing.html` | Jarayonning aniq holatini ko'rish |
| Tayyor | `child-ui/complete.html` | Agent fon rejimida ishlashini tasdiqlash |

Installerda UAC nima uchun kerakligi oldindan tushuntiriladi. Rozilik qadami o'tkazib yuborilmaydi.

### 6.2. O'rnatilgandan keyingi holatlar

| Holat | Dizayn fayli | Qoidasi |
|---|---|---|
| Tray status | `child-ui/status.html` | Bugungi vaqt, qolgan limit va shaffoflik havolasi |
| Shaffoflik | `child-ui/privacy.html` | Ota-ona ko'radigan va ko'rmaydigan ma'lumotlar |
| Limit tugadi | `child-ui/limit-reached.html` | Tinch, ayblovsiz full-screen tushuntirish |
| Ilova cheklangan | `child-ui/app-restricted.html` | “Hozircha mavjud emas” mazmunidagi block holati |

Tray holatlari: yashil — normal; amber — vaqt kamaymoqda; kulrang — limit tugagan yoki faol cheklov. Bola ilovasi ichida “o'chirish”, “to'xtatish” yoki qoida tahrirlash funksiyasi bo'lmaydi.

## 7. Ma'lumotlar va etik chegaralar

Ota-ona ko'rishi mumkin:

- ilova nomi va undan foydalanish davomiyligi;
- saytning domen nomi;
- ekran vaqti;
- limit yoki cheklov bilan bog'liq alertlar;
- qurilmaning onlaynligi va oxirgi sinxronizatsiyasi.

Mahsulot yig'maydi yoki ko'rsatmaydi:

- yozishmalar, matn yoki clipboard;
- parollar va tugma bosishlar;
- kamera/mikrofon oqimi;
- to'liq URL/page-content;
- yashirin ekran tasviri.

Bu ajratish parent onboarding, installer consent va child privacy sahifalarida bir xil mazmunda ifodalanadi.

## 8. Texnik oqim

```text
Windows agent
  ├─ foreground app / device state → local SQLite buffer
  ├─ cached rules → local enforcement + child UI
  └─ sync batch → Django API

Django API
  ├─ parent JWT → devices, summary, rules, alerts
  ├─ device secret → tracking ingest, rules fetch, alert report
  └─ Channels → installer enrollment linked signal

Parent web/mobile
  └─ parent JWT → real-timega yaqin dashboard va qoida boshqaruvi
```

Agent qoidalarni lokal cache'dan oladi. Server bilan aloqa uzilganda bola “xato” ko'rmaydi: eventlar bufferda qoladi va keyingi ulanishda yuboriladi.

## 9. Hozirgi funksional qamrov va cheklovlar

Hozirgi kod bazasida enrollment, device list/detail, tracking ingest/summary, daily limit, blocked app, alerts, buffer/sync va agent update tekshiruvi mavjud.

Quyidagilar keyingi product qarorisiz production UI va'dasi bo'lmasligi kerak:

- browser domain darajasidan chuqurroq tahlil;
- app kategoriyalari va “activity score”;
- PDF/CSV hisobot eksporti;
- billing, SMS, 2FA va multi-parent boshqaruvi;
- Android/iOS/macOS agentlari;
- qurilmani masofadan qulflash, qayta yuklash yoki ovoz chiqarish;
- signed OTA update, rollback va anti-tamper hardening.

`docs/known-issues.md`dagi crash-mid-flight batch dublikati hardening bosqichida bartaraf etiladi.

## 10. Ishlab chiqish tartibi

1. `parent-web`dagi real ekranlarni `parent-ui` dizayn tizimiga mos komponentlashtirish.
2. Child installer oqimini Windows installerga, status/block holatlarini Go agent UI'ga o'tkazish.
3. Parent va child shaffoflik matnlarini yagona content manbasiga o'tkazish.
4. Real Windows qurilmada tray, block-screen, service va updater oqimini sinash.
5. Hardening: persistent batch ID, credential himoyasi, signed update, audit va anti-tamper siyosati.

## 11. Qabul qilish mezonlari

- Parent va Child barcha holatlarda bir xil brend tili, rang va tipografiyani ishlatadi.
- Ota-ona faqat mavjud API ma'lumotini ko'radi; demo metrikalar production ko'rinishiga aralashmaydi.
- Bola tray oynasida vaqt/qoida ko'radi, ammo ularni o'zgartira olmaydi.
- Rozilik va privacy tushuntirishi installer, parent onboarding va child UI'da mavjud.
- Tor ekranlarda parent prototipining navigatsiyasi, kartalari, modallari va jadvallari buzilmaydi.
- Tarmoq uzilishi child foydalanuvchiga texnik xato sifatida ko'rinmaydi.
