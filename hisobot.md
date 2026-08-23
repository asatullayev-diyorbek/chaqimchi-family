# ChaqimchiAI Family — joriy holat hisoboti

**Hisobot sanasi:** 2026-08-19  
**Repo:** `SergakChaqimchiAI`  
**Maqsad:** backend, Windows child agent, parent web/mobile va UI qatlamlarida hozirgacha bajarilgan ishlarni, ishlash darajasini va MVP uchun qolgan ishlarni qayd etish.

## 1. Qisqa xulosa

Loyihaning asosiy qismlari mavjud va ular orasidagi kerakli kontraktlar yozilgan:

```text
Windows Child Device
        ↓
ChaqimchiAI Guard
        ↓
Local SQLite buffer
        ↓
POST /api/tracking/ingest/
        ↓
Django database
        ↓
Parent Web / Parent Mobile dashboard
```

Hozirgi holatni **“local E2E va real Windows installer/pairing oqimi ishladi;
real activity ingest demo’si hali alohida tasdiqlanadi”** deb baholash mumkin.

Muhim cheklovlar:

- Windows installer real Windows qurilmasida o‘rnatildi va UAC huquqi bilan ishladi.
- Pairing code/QR → Parent Web verify → Guard link oqimi real muhitda ishladi.
- Backend va Parent Web dependency’lari tiklandi; test/build qayta bajarildi.
- Go, Django va Parent Web tekshiruvlari muvaffaqiyatli o‘tdi.
- Activity summary va screen-time aggregation mavjud, lekin alohida xom activity-history endpoint/UI hali to‘liq ajratilmagan.

## 2. Backend — Django + DRF + Channels

### 2.1. Texnologik baza

- Django 6 va Django REST Framework.
- JWT authentication (`rest_framework_simplejwt`).
- Channels/Daphne orqali WebSocket enrollment xabari.
- SQLite local fallback; Postgres env sozlamalari orqali qo‘llab-quvvatlanadi.
- Redis channel layer production uchun, in-memory layer local development uchun.
- CORS origin’lari env orqali boshqariladi.
- Media fayllar local `server/media/` papkasiga saqlanadi.

### 2.2. Authentication va family modeli

Amalga oshirilgan:

- `ParentUser` — email/password asosidagi ota-ona foydalanuvchisi.
- `Family` — tenant/family chegarasi.
- Signup, login, refresh token va `/api/auth/me/` endpoint’lari.
- Parent endpoint’larida family isolation tekshiriladi.
- `Child` modeli: ism, tug‘ilgan sana, rasm va family bog‘lanishi.
- Child CRUD endpoint’lari.
- Rasm uchun 5 MB limit va PNG/JPG/WEBP header validation.

Asosiy endpoint’lar:

```text
POST /api/auth/signup/
POST /api/auth/login/
POST /api/auth/login/refresh/
GET  /api/auth/me/
GET  /api/children/
POST /api/children/
PATCH/DELETE /api/children/<id>/
```

### 2.3. Device pairing/enrollment

Amalga oshirilgan:

- `ChildDevice` modeli: family, child, platform, status, secret, linked_at, last_sync.
- 6 xonali pairing code generatsiyasi.
- Pairing code 10 daqiqa amal qiladi.
- QR payload: `chaqimchi://enroll?token=<code>`.
- Installer uchun auth talab qilmaydigan code generation endpoint.
- Parent-authenticated verify endpoint.
- QR/manual code orqali child device’ni parent family va child bilan bog‘lash.
- Pairing tugagach WebSocket orqali `{"event": "linked"}` yuborish.
- Device list, rename va unlink endpoint’lari.
- Unlink paytida device qatori o‘chirilmaydi; tarixiy event’lar saqlanadi.

Asosiy endpoint’lar:

```text
POST /api/enroll/generate-code/
POST /api/enroll/verify-code/
GET  /api/devices/
PATCH/DELETE /api/devices/<id>/
WS   /ws/enroll/<device_id>/
```

### 2.4. Device authentication

Windows agent uchun alohida authentication yozilgan:

```text
Authorization: Device <device_id>:<device_secret>
```

U quyidagilarni tekshiradi:

- device ID mavjudligi;
- device secret mosligi;
- request’da authenticated object sifatida `ChildDevice` ishlatilishi.

Tracking ingest parent JWT bilan emas, aynan device secret bilan ishlaydi.

### 2.5. Activity ingest va screen-time summary

Amalga oshirilgan:

- `EventBatch` va `Event` modellari.
- Event turlari: `app_usage`, `browser_domain`, `screen_time_summary`, `device_state`.
- Device-secret authenticated `POST /api/tracking/ingest/`.
- `schema_version`, `batch_id`, `sent_at`, agent metadata va event list validation.
- Batch idempotency: bir xil `batch_id` qayta kelsa event’lar takror yozilmaydi.
- Unknown event type’lar skip qilinadi va response’da hisob qaytariladi.
- Har bir successful ingest `ChildDevice.last_sync`ni yangilaydi.
- App usage event’laridan application bo‘yicha minutlar hisoblanadi.
- `day`, `week`, `month` range’lari mavjud.
- Device online/offline holati oxirgi 5 daqiqadagi ingest asosida aniqlanadi.
- Summary’da child profili, photo URL, total screen minutes, top apps, last usage va daily breakdown qaytariladi.

Asosiy endpoint:

```text
POST /api/tracking/ingest/
GET  /api/tracking/summary/<device_id>/?date=YYYY-MM-DD&range=day|week|month
```

### 2.6. Rules, alerts va deploy

Repo’da qo‘shimcha backend modullari ham mavjud:

- `rules` app — daily limit va blocked-app rule CRUD.
- `alerts` app — alert list va mark-seen oqimi.
- `deploy` app — agent version/release metadata va download/release URL oqimi.
- `/api/health/` health endpoint.
- Local release/static media serve qilish uchun development route’lari.

Bu modullar MVP vertical slice’ning birinchi zarur qismi emas, lekin parent UI bilan API darajasida bog‘langan.

## 3. Windows Child — Go Guard Agent

### 3.1. Active application collector

Windows-only tracker foreground window’ni polling qiladi:

- foreground window’ning process ID’sini oladi;
- process executable nomini aniqlaydi;
- application o‘zgarganda oldingi intervalni yakunlaydi;
- `app_usage` event yaratadi;
- `started_at`, `ended_at`, `duration_seconds`, `app_id`, `app_name` maydonlarini yozadi.

Standart polling interval: **10 soniya**.

Bu MVP uchun asosiy collector hisoblanadi.

### 3.2. Device state collector

Har 60 soniyada `device_state` event yoziladi:

- battery percentage;
- local network interface mavjudligi;
- power source placeholder;
- screen lock/session holati.

Battery’siz desktop qurilmada unavailable holat `-1` sifatida qaytariladi.

### 3.3. Local durable buffer

`modernc.org/sqlite` asosidagi local buffer mavjud:

- event’lar `buffer.db`ga darhol yoziladi;
- `synced` flag ishlatiladi;
- unsynced event’lar batch qilib olinadi;
- pending batch alohida saqlanadi;
- process restart’dan keyin aynan o‘sha batch ID qayta yuboriladi;
- server acknowledgement’dan keyin event’lar transactional tarzda synced qilinadi.

Bu offline/network uzilishida event’larni yo‘qotmaslik uchun asosiy qatlam.

### 3.4. Backend uploader

Uploader:

- backend health check qiladi;
- 50 tagacha event’dan batch tuzadi;
- `POST /api/tracking/ingest/`ga yuboradi;
- `Device <id>:<secret>` authorization ishlatadi;
- acknowledgement’dagi batch ID’ni tekshiradi;
- xatoda event’larni buffer’da qoldiradi;
- odatda har 60 soniyada sync qiladi.

### 3.5. Windows service va installer

Yozilgan:

- Windows Service Control Manager integratsiyasi.
- Automatic start.
- Failure recovery/restart konfiguratsiyasi.
- Existing service’ni update/restart qilish oqimi.
- Installer ichiga `agent.exe` payload embed qilish.
- Installer’ning vaqtinchalik fayl orqali agent binary’ni o‘rnatishi.
- Pairing code/QR olish va parent link’ni WebSocket orqali kutish.
- Pairing tugagach device credentials bilan Guard service o‘rnatish.
- HTTPS validation; local development uchun explicit `--allow-insecure-http` flag.

### 3.6. Visible child desktop companion

`cmd/desktop` va local IPC yozilgan:

- Guard service monitoring qiladigan ma’lumotlarni read-only local endpoint orqali beradi;
- tray UI service status, version, start time va monitoring ro‘yxatini ko‘rsatadi;
- kuzatilmaydigan ma’lumotlar ham foydalanuvchiga ochiq ko‘rsatiladi;
- child consent, enrollment wizard, status, block screen va boshqa Windows UI komponentlari mavjud.

### 3.7. Rules/enforcement/updater

Agent ichida quyidagilar bor:

- rules cache;
- rules fetcher;
- blocked-app foreground check;
- daily limit check;
- alert reporter;
- updater checker/updater package;
- service self-restart/recovery mexanizmi.

Automatic update hozircha ataylab **disabled**. Signed update, hash verification,
consent va rollback to‘liq tasdiqlanmaguncha ishlab chiqarish update oqimi yoqilmaydi.

## 4. Parent Web — Next.js dashboard

### 4.1. Ishlayotgan sahifalar

Next.js App Router asosida quyidagi sahifalar yozilgan:

```text
/login
/signup
/overview
/activity
/devices
/devices/<id>
/alerts
/rules
```

### 4.2. Web dashboard imkoniyatlari

- Parent signup/login.
- JWT access/refresh token oqimi.
- 401 bo‘lganda token refresh va request retry.
- Child profile yaratish, edit qilish, birth date va photo upload.
- Qurilmalar ro‘yxati.
- Child bo‘yicha device filter.
- Pairing code’ni kiritish va device’ni child’ga bog‘lash.
- Device rename va unlink.
- Online/offline va last-sync ko‘rsatish.
- Bugungi screen time.
- Week/month/day activity summary.
- Top applications ro‘yxati va minutlar.
- Daily breakdown chart.
- Alerts list va mark-seen.
- Daily limit va blocked application rule’lari.
- Device detail sahifasida summary/rules/profile ko‘rinishi.
- Media proxy route orqali child photo’ni ko‘rsatish.
- Responsive layout, sidebar, header, topbar action’lar va loading/empty state’lar.

### 4.3. Web API qatlamlari

`parent-web/src/api/` ichida alohida client modul’lari mavjud:

- `auth.ts`
- `children.ts`
- `tracking.ts`
- `alerts.ts`
- `rules.ts`
- umumiy `client.ts`

Bu qatlam backend endpoint’larini UI’dan ajratib turadi.

## 5. Parent Mobile — Expo / React Native

### 5.1. Navigation

React Navigation stack mavjud:

```text
Login
Signup
Home
QRScan
Rules
Alerts
```

Login/signup’dan keyin linked device bo‘lsa Home’ga, aks holda QRScan’ga yo‘naltirish bor.

### 5.2. Mobile imkoniyatlari

- Parent signup/login.
- JWT tokenni API client orqali saqlash.
- QR barcode scanner.
- 6 xonali code’ni qo‘lda kiritish.
- Backend verify-code orqali device pairing.
- Home’da online/offline, last seen, total screen time va top apps.
- Rules sahifasida daily limit va blocked apps boshqaruvi.
- Alerts list va barcha alert’larni seen qilish.
- Shared UI primitives: Screen, Card, Button, Field, EmptyState va rang/style token’lari.

## 6. Child UI va Parent UI

### 6.1. `child-ui/`

Bu papka static HTML/CSS visual flow hisoblanadi. Unda quyidagi ekranlar bor:

- welcome;
- consent/privacy;
- connect/pairing;
- installing;
- complete;
- status;
- restricted/limit reached.

Bu UI prototype sifatida foydali, lekin Windows Guard’ning asosiy runtime rendering qatlami emas. Runtime Windows oynalari Go `walk` UI orqali qurilgan.

### 6.2. `parent-ui/`

Bu alohida nested Git repository ko‘rinishidagi static parent dashboard prototype:

- overview;
- devices;
- device detail;
- activity/reports;
- settings;
- local assets.

Asosiy ishlaydigan web dashboard esa `parent-web/` ichidagi Next.js loyiha hisoblanadi. `parent-ui/`ni production runtime bilan aralashtirmaslik kerak.

## 7. Test va tekshiruv holati

### 7.1. Hozir tasdiqlangan

Host muhitida:

```text
cd agent
go test ./...
```

natija: **PASS**.

Tekshirilgan Go paketlari:

- endpoint validation;
- local IPC status;
- rules enforcer;
- service recovery config;
- uploader/idempotent sync;
- updater checker.

### 7.2. Qolgan tekshiruvlar

- Parent mobile build/start hali ishga tushirilmagan; mobile dependency’lari keyingi bosqichda tiklanadi.
- Windows Guard install, UAC, service o‘rnatish va pairing real Windows’da PASS.
- Active application → SQLite → ingest → dashboard minutlari real Windows’da hali yakuniy PASS qilinmagan.

## 8. Hozirgi MVP readiness bahosi

| Qism | Kod holati | Real tekshiruv | Baholash |
|---|---|---|---|
| Parent auth | Mavjud | Django testlari PASS | Tayyor |
| Device pairing | Mavjud | Real Windows installer + Parent Web E2E PASS | Tayyor |
| Active app collector | Mavjud | Real Chrome/VS Code capture kerak | MVP P0 |
| Local event buffer | Mavjud | Go tests PASS | Tayyor |
| API ingest | Mavjud | Django 36/36 PASS + synthetic ingest PASS | Tayyor |
| Screen-time summary | Mavjud | Synthetic event PASS; real agent event kerak | Kod darajasida tayyor |
| Parent web dashboard | Mavjud | lint PASS, build PASS, routes HTTP 200 | Tayyor |
| Parent mobile | Mavjud | Expo device/simulator kerak | Kod darajasida tayyor |
| Activity history | Qisman | Alohida event timeline kerak | Keyingi P0/P1 |
| Real Windows service | Yozilgan | Installer/UAC/service oqimi PASS; recovery testi qolgan | Qisman tayyor |

## 9. Aniqlangan texnik qarzlar va ehtiyot bo‘ladigan joylar

- `month` summary haqiqiy calendar month emas, trailing 30 kunlik window sifatida ishlaydi.
- Online status real-time push emas, oxirgi 5 daqiqadagi ingest heuristic’iga asoslanadi.
- Screen-time collector polling asosida ishlaydi; session reconciliation va sleep/lock holatlari hali mukammal emas.
- `device_state` payload’ida ayrim maydonlar hozircha placeholder qiymatga ega.
- Raw activity event timeline uchun parent’ga alohida endpoint va UI kerak.
- Windows installer/service hali code signing va production trust oqimiga ega emas.
- Automatic updater xavfsizlik talablari sabab o‘chirilgan.
- Local development default’lari (`DEBUG`, local SQLite, localhost backend) production sozlamalaridan alohida boshqarilishi kerak.
- Repo’da `.DS_Store`, Python `__pycache__`, release binary va prototype materiallar mavjud; ular runtime source bilan aralashtirilmasin.

## 10. Keyingi eng kichik ishlaydigan qadamlar

MVP execution priority bo‘yicha:

1. Dependency’larni qayta o‘rnatish.
2. Backend migration va Django testlarini ishga tushirish.
3. Parent web lint/build’ni ishga tushirish.
4. Backend’ni local ishga tushirish.
5. Windows agent/installer’ni cross-build qilish.
6. Real Windows’da Guard’ni ishga tushirish.
7. Chrome yoki VS Code’ni faol application sifatida kuzatish.
8. `POST /api/tracking/ingest/`ga event kelganini tekshirish.
9. Parent overview/activity sahifasida minutlar ko‘ringanini tasdiqlash.
10. Shundan keyin alohida activity history endpoint/UI qo‘shish.

## 11. MVP E2E demo tekshiruvi — 2026-08-19

Berilgan “First Real E2E Demo” task bo‘yicha local muhitda quyidagi ishlar bajarildi:

### PASS

- Backend dependency’lari qayta o‘rnatildi.
- Django migration’lari bajarildi.
- Django system check’da muammo topilmadi.
- Django testlari: **36/36 PASS**.
- `/api/health/`: **HTTP 200**.
- Parent signup/login: **PASS**.
- Pairing code generation va verify: **PASS**.
- Device-secret authentication bilan ingest: **PASS**.
- `EventBatch` va `Event` database’ga yozildi.
- Summary endpoint real event’dan quyidagini qaytardi:

```text
chrome.exe — 10 min
device_status — online
```

- Parent Web dependency’lari qayta o‘rnatildi.
- Parent Web lint: **0 error, 31 warning**.
- Parent Web production build: **PASS**.
- `/login`, `/overview`, `/activity` route’lari local server’da **HTTP 200**.
- Windows `agent.exe` cross-build: **PASS**.
- Windows `installer.exe` cross-build: **PASS**.
- Windows installer real qurilmada o‘rnatildi: **PASS**.
- Parent Web orqali real device pairing: **PASS**.
- UAC elevation va Windows service o‘rnatilishi: **PASS**.

### BLOCKED / QOLGAN P0

- Active application collector’ni real Windows desktop’da Chrome → VS Code almashinuvi bilan tekshirish.
- SQLite buffer’ning network uzilgan paytdagi real Windows behavior’ini tekshirish.
- Real event’dan Parent Dashboard’da application minutlarini ko‘rsatish.

### Hozirgi aniq natija

Backend va dashboard kontrakti synthetic event bilan ishladi:

```text
Pair device
↓
POST /api/tracking/ingest/
↓
EventBatch + Event
↓
GET /api/tracking/summary/<device_id>/
↓
chrome.exe — 10 min, online
```

Real MVP victory hali quyidagi bitta tashqi qadamga bog‘liq:

```text
Real Windows Chrome/VS Code
↓
Guard active-app collector
↓
SQLite buffer
↓
Backend
↓
Parent Dashboard
```

## 13. Yangilangan task statusi — 2026-08-19

### PASS

- [x] Backend dependency’lari tiklandi.
- [x] Django migration va testlar: **36/36 PASS**.
- [x] Backend health endpoint: **HTTP 200**.
- [x] Parent Web dependency, lint va production build: **PASS**.
- [x] Windows `agent.exe` va `installer.exe` GUI cross-build: **PASS**.
- [x] Windows installer real qurilmada o‘rnatildi.
- [x] `C:\Program Files\ChaqimchiAI` uchun UAC/admin elevation tuzatildi.
- [x] Installer pairing code/QR oynasi ishladi.
- [x] Parent Web orqali device pairing real muhitda muvaffaqiyatli yakunlandi.
- [x] Pairing tugagach Windows service o‘rnatish oqimi ishladi.
- [x] Bir child uchun faqat oxirgi linked device aktiv qoldiriladi; eski tarix saqlanadi.
- [x] Dashboard device list va detail sahifalaridagi mock usage/hardware qiymatlari olib tashlandi.
- [x] Foydalanish vaqti endi faqat `/api/tracking/summary/`dan olinadi.

### QOLGAN P0

- [ ] Real Windows’da Chrome va VS Code active application eventlarini capture qilish.
- [ ] Event’larning SQLite buffer’da paydo bo‘lishini tekshirish.
- [ ] Real event’larning `/api/tracking/ingest/`ga yuborilishini tekshirish.
- [ ] Dashboard’da `Chrome — N min`, `VS Code — N min` natijasini ko‘rsatish.
- [ ] Offline → online sync va service restart/recovery testi.

## 14. Xulosa

ChaqimchiAI Family’ning backend, Windows child agent, parent web va parent
mobile qatlamlari bo‘yicha katta qismi yozilgan. Eng muhim MVP pipeline uchun
kerakli komponentlar — pairing, active application collection, durable local
buffer, authenticated ingest, database aggregation va parent dashboard — kodda
mavjud.

Hozirgi asosiy vazifa yangi architecture yoki qo‘shimcha documentation emas.
Asosiy vazifa — mavjud qismlarni bir muhitda ishga tushirib, quyidagi natijani
ko‘rsatish:

```text
Chrome active
↓
Windows Guard collector
↓
Local SQLite buffer
↓
POST /api/tracking/ingest/
↓
Django Event/EventBatch
↓
Parent Dashboard: Chrome — N min
```

Shu demo tasdiqlangandan keyin loyiha “kod yozilgan” holatidan “ishlayotgan
MVP” holatiga o‘tadi.

## 15. Activity History MVP — 2026-08-19

### PASS

- [x] `GET /api/tracking/history/<device_id>/` endpoint qo‘shildi.
- [x] Faqat `app_usage` eventlari timeline’ga chiqariladi.
- [x] Family isolation tekshiruvi mavjud.
- [x] `date`, `limit`, `offset` va empty result ishlaydi.
- [x] Backend tracking testlari: **41/41 PASS**.
- [x] Parent Web’da `Faoliyat tarixi` tab qo‘shildi.
- [x] Loading, empty va error holatlari qo‘shildi.
- [x] Oldingi/keyingi pagination qo‘shildi.
- [x] Activity qiymatlari faqat backend Event ma’lumotidan olinadi; mock timeline yo‘q.
- [x] Parent Web lint: **0 error**.

### BLOCKED / QOLGAN

- [x] Parent Web Google Fonts’ga bog‘liqlik olib tashlandi; system font fallback ishlatiladi.
- [x] Parent Web production build: **PASS**.
- [x] Dead state/functionlar tozalandi; overview va device detail’dagi ortiqcha API requestlar qisqartirildi.
- [x] Parent Web lint warninglari 29 tadan 12 tagacha kamaytirildi.
- [x] Lokal logo/profile rasmlari `next/image`ga o‘tkazildi.
- [x] Iconify script `beforeInteractive`dan `afterInteractive`ga o‘tkazildi.
- [x] Lokal logo/profile assetlariga dimensions, decoding va priority/lazy loading qo‘shildi.
- [x] Activity va Devices sahifalariga skeleton/loading/error holatlari qo‘shildi.
- [x] Summary xatosi uchun qayta urinish oqimi qo‘shildi.
- [ ] Real Windows event’ini History tab’da ko‘rsatish hali bajarilmagan; bu real Tracking E2E testiga bog‘liq.

## 16. Backend optimization — 2026-08-19

- [x] Summary endpoint’dagi kunlik va ilova bo‘yicha N+1 query’lar bitta range query’ga qisqartirildi.
- [x] `last_used_at` endi alohida query’siz, yuklangan event’lardan hisoblanadi.
- [x] `Event(device, event_type, occurred_at)` composite index qo‘shildi.
- [x] Device list uchun `ChildDevice.child` `select_related` qilindi.
- [x] Migration qo‘llandi: `tracking.0002_event_query_indexes`.
- [x] Backend testlar: **41/41 PASS**.

## 17. Frontend latency optimization — 2026-08-19

- [x] GET requestlar uchun 15 soniyalik in-memory cache qo‘shildi.
- [x] Bir xil va parallel GET requestlar in-flight deduplication orqali birlashtiriladi.
- [x] Mutation’dan keyin GET cache avtomatik tozalanadi.
- [x] Devices sahifasida faqat linked qurilmalar uchun summary so‘raladi.
- [x] Activity sahifasida summary faqat `Ekran vaqti` yoki `Ilovalar` tabida yuklanadi.
- [x] Faoliyat tarixi faqat o‘z tab’i ochilganda yuklanadi.
- [x] Parent Web lint: **0 error**.
- [x] Parent Web production build: **PASS**.
