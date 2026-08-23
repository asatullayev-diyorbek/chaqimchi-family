# ChaqimchiAI — MVP Execution Directive

## MUHIM: BU HUJJATNING MAQSADI

ChaqimchiAI loyihasida hozir eng katta muammo — texnik qoidalar, architecture,
ADR, security policy va documentation juda ko‘payib ketgani, lekin real
ishlaydigan MVP natijasi yetarli darajada tez chiqmayotgani.

Shu sababli ushbu hujjat agent uchun hozirgi bosqichdagi asosiy execution
priority hisoblanadi. U mavjud xavfsizlik va loyiha qoidalarini bekor qilmaydi;
ular doirasida qaysi ishni birinchi bajarish kerakligini belgilaydi.

AGENTNING ASOSIY VAZIFASI:

> QOIDALAR YOZISH EMAS.  
> HUJJATLARNI KO‘PAYTIRISH EMAS.  
> YANGI ARCHITECTURE O‘YLASH EMAS.  
> ISHLAYDIGAN MVP QURISH.

Har bir ishning oxirida foydalanuvchi ko‘ra oladigan yoki test orqali
tasdiqlanadigan REAL NATIJA bo‘lishi kerak.

---

# 1. MVP FIRST

Hozirgi asosiy maqsad:

```text
Windows Child Device
↓
ChaqimchiAI Guard
↓
Activity Collection
↓
Backend API
↓
Parent Dashboard
```

Mana shu pipeline ishlashi kerak.

Mukammal architecture keyin.

Mukammal security keyin.

Enterprise infrastructure keyin.

Code signing keyin.

AI keyin.

---

# 2. MVP NIMANI QILA OLISHI KERAK?

MVP quyidagi 5 ta asosiy imkoniyatni ishlatishi kerak:

## 1. Qurilma ulash

Farzand Windows kompyuterida:

```text
ChaqimchiAI Guard
```

ochiladi.

```text
Qurilmani ulash
```

tanlanadi.

QR yoki 6 xonali pairing code hosil bo‘ladi.

Ota-ona uni dashboard orqali ulaydi.

Natija:

```text
✓ Qurilma ulandi
```

## 2. Qurilma holati

Parent Dashboard:

```text
Ali's Windows PC

● Online

Last seen:
10:32
```

ko‘rsatishi kerak.

## 3. Ekran vaqti

Guard Windows'da ishlayotgan vaqtni hisoblaydi.

Dashboard:

```text
Bugun

Screen Time

3 soat 24 daqiqa
```

ko‘rsatadi.

## 4. Ilovalar faoliyati

Guard faol ishlatilayotgan application'ni aniqlaydi.

Masalan:

```text
Chrome       1h 42m
VS Code      1h 15m
Telegram     32m
Discord      18m
```

Dashboardda ko‘rinadi.

## 5. Faoliyat tarixi

Parent:

```text
Faoliyat tarixi

10:32
Chrome ochildi

10:18
VS Code ishlatildi

09:54
Telegram ishlatildi
```

kabi ma'lumotlarni ko‘ra oladi.

---

# 3. MVP'DA BO‘LMAYDI

Quyidagilar hozir MVP uchun majburiy emas.

Ularni implement qilishga vaqt sarflanmasin:

- AI recommendations
- AI analysis
- Web filtering
- Complex website history
- Game analytics
- iOS
- Android
- macOS
- Smart Home
- Advanced notifications
- Complex blocking system
- Enterprise admin
- Billing
- Subscription
- Advanced analytics
- Complex permissions
- Advanced synchronization
- Perfect offline conflict resolution
- Code signing
- EV certificate
- Complex updater
- Production-grade observability
- Advanced telemetry

Bularning hammasi keyingi bosqich.

---

# 4. MUHIM QOIDA: "WORKING RESULT > DOCUMENTATION"

Agar tanlov:

```text
A) 3 soat architecture documentation yozish

B) 3 soat real feature implement qilish
```

bo‘lsa:

```text
B
```

tanlanadi.

Agar documentation kerak bo‘lsa, faqat implementatsiyani tushuntirish uchun
minimal documentation yoziladi.

---

# 5. YANGI QOIDA O‘YLAB TOPMA

Agent mavjud project rules ichida yo‘q yangi architecture yoki policy o‘ylab
topmasin.

Avval:

```text
Existing code
Existing architecture
Existing contracts
Existing APIs
```

tekshirilsin.

Agar mavjud yechim ishlayotgan bo‘lsa:

> REUSE IT.

Noldan qayta yozilmasin.

---

# 6. EXISTING CODE'NI BUZMA

Mavjud:

- API
- database
- contracts
- event envelope
- security filter
- local storage
- dashboard
- device model

ishlayotgan bo‘lsa, ularni sababsiz qayta yozish taqiqlanadi.

Minimal o‘zgarish bilan yangi feature qo‘shilsin.

---

# 7. VERTICAL SLICE

Har bir task vertical slice bo‘lishi kerak.

Masalan:

```text
Windows App
↓
Collector
↓
API
↓
Database
↓
Dashboard
```

Faqat backend yozib qo‘yish yetarli emas.

Faqat UI chizish ham yetarli emas.

Feature oxirigacha ishlashi kerak.

---

# 8. HAR BIR TASK UCHUN DEFINITION OF DONE

Task DONE hisoblanadi faqat:

1. Kod yozilgan.
2. Build o‘tgan.
3. Test o‘tgan.
4. Real output mavjud.
5. Iloji bo‘lsa real Windows qurilmada tekshirilgan.
6. Parent Dashboard'da natija ko‘ringan.

Masalan:

```text
Collector implemented
```

DONE EMAS.

To‘g‘ri:

```text
Windows active app
↓
Chrome
↓
Collector
↓
POST /activity
↓
Database
↓
Dashboard
↓
Chrome — 12m
```

---

# 9. HAR BIR ISHNI BOSHLASHDAN OLDIN

Agent o‘ziga 3 ta savol bersin:

### Savol 1

Bu MVP uchun kerakmi?

Agar:

```text
YO‘Q
```

bo‘lsa:

> HOZIR QILMA.

### Savol 2

Bu real foydalanuvchi ko‘radigan natija beradimi?

Agar:

```text
YO‘Q
```

bo‘lsa:

> PRIORITETNI PASAYTIR.

### Savol 3

Buni mavjud library/repo bilan tezroq qilish mumkinmi?

Agar:

```text
HA
```

bo‘lsa:

> REUSE.

---

# 10. OSS REPOSITORYLARDAN FOYDALANISH

Biz barcha narsani noldan yozmaymiz.

Kerak bo‘lsa:

WinSW: <https://github.com/winsw/winsw>

Windows Service uchun.

ZXing.Net: <https://github.com/micjahn/ZXing.Net>

QR uchun.

NetSparkle: <https://github.com/NetSparkleUpdater/NetSparkle>

Updater uchun.

Inno Setup: <https://github.com/jrsoftware/issrc>

Installer uchun.

Lekin:

> OSS library topishning o‘zi task emas.

Library faqat real MVP feature'ni tezlashtirsa ishlatiladi.

---

# 11. HOZIRGI ENG MUHIM TASK

## Windows Activity Collector

Birinchi real vertical slice shu bo‘lishi kerak.

Guard Windows'da:

1. Active application'ni aniqlaydi.
2. Application nomini oladi.
3. Start time'ni saqlaydi.
4. Active time'ni hisoblaydi.
5. Activity event yaratadi.
6. Backend API'ga yuboradi.
7. Backend database'ga saqlaydi.
8. Dashboard ko‘rsatadi.

---

# 12. EXPECTED RESULT

Windows'da:

```text
Chrome active
```

Guard aniqlaydi.

Backendga:

```json
{
  "device_id": "...",
  "application": "Google Chrome",
  "started_at": "...",
  "duration_seconds": 120
}
```

yuboradi.

Dashboard:

```text
Google Chrome

2 min
```

ko‘rsatadi.

Keyin:

```text
Chrome      42 min
VS Code     31 min
Telegram    18 min
```

ko‘rinishiga keladi.

---

# 13. KEYINGI TASKLAR

Vertical slice ishlagandan keyin:

### Task 2

Screen Time aggregation.

```text
Today:
3h 42m
```

### Task 3

Activity History.

```text
10:32 Chrome
10:18 VS Code
09:54 Telegram
```

### Task 4

Device pairing.

```text
PC → QR
Parent → Scan
Backend → Pair
PC → Connected
```

### Task 5

Device status.

```text
Online
Offline
Last Seen
```

---

# 14. UI'NI ORTIQCHA MURAKKABLASHTIRMA

Parent Dashboard minimal bo‘lishi kerak.

Bir ekranda juda ko‘p ma'lumot ko‘rsatmaslik kerak.

Activity:

```text
[ Ilovalar ]

[ Web-saytlar ]

[ Faoliyat tarixi ]
```

kabi tablar bilan ajratiladi.

MVP uchun:

```text
Ilovalar
Ekran vaqti
Faoliyat tarixi
Qurilmalar
```

yetarli.

---

# 15. "PERFECT" TALABINI TO‘XTAT

MVP uchun:

```text
Working > Perfect
Simple > Complex
Real > Theoretical
Fast > Over-engineered
```

Agar feature 80% sifatda ishlayotgan bo‘lsa va real foydalanuvchiga ko‘rsatish
mumkin bo‘lsa:

> uni MVP'ga qo‘sh.

Keyin yaxshilanadi.

---

# 16. AGENTNING JAVOB FORMATI

Har task oxirida agent uzun nazariy report bermasin.

Quyidagicha qisqa report bersin:

```text
DONE

Implemented:
- Active application collector
- Activity API
- Database storage
- Dashboard display

Test:
- Build: PASS
- Tests: PASS

Verified:
Chrome → 12 min → Dashboard

Next:
Screen Time aggregation
```

Agar ishlamagan bo‘lsa:

```text
BLOCKED

Problem:
...

Reason:
...

Required:
...
```

---

# 17. YANGI TASK TAKLIF QILISHDA

Agent:

```text
We should redesign the architecture...
```

deb taskni kattalashtirmasin.

Buning o‘rniga:

```text
Next smallest working step:
...
```

ni taklif qilsin.

---

# 18. MVP DEADLINE MENTALITY

Biz startup/product qurmoqdamiz.

Shuning uchun har kuni savol:

> "Bugun foydalanuvchiga ko‘rsatadigan nima ishladi?"

bo‘lishi kerak.

Savol:

> "Bugun nechta documentation yozildi?"

emas.

---

# 19. PRIORITY

Har doim quyidagi tartibda ishlash:

```text
P0 — Working MVP feature
P1 — Bug fixing
P2 — Basic security
P3 — Basic tests
P4 — UX improvements
P5 — Documentation
P6 — Optimization
P7 — Future architecture
```

P0 tugamasdan P5-P7'ga o‘tilmaydi.

---

# 20. FINAL DIRECTIVE

Agent, ushbu loyihada hozir asosiy maqsad:

> CHAQIMCHIAI FAMILY'NING ISHLAYDIGAN MVP'SINI TEZ CHIQARISH.

Shuning uchun:

- yangi qoida yozma;
- keraksiz documentation yozma;
- architecture'ni qayta qurma;
- mavjud kodni sababsiz refactor qilma;
- har bir narsani mukammallashtirishga urinma;
- feature'ni ortiqcha kengaytirma;
- yangi dependency faqat kerak bo‘lsa qo‘sh.

Buning o‘rniga:

```text
IMPLEMENT
↓
BUILD
↓
TEST
↓
RUN
↓
VERIFY
↓
SHOW RESULT
```

shu sikl bilan ishlagin.

## Birinchi maqsad

Windows kompyuterida Guard ishga tushsin.

Guard faol application'ni aniqlasin.

Ma'lumot backendga yuborilsin.

Backend saqlasin.

Parent Dashboard ko‘rsatsin.

Shu ishlasa — biz MVP'ga real qadam qo‘ygan bo‘lamiz.

Qolgan hamma narsa keyin.
