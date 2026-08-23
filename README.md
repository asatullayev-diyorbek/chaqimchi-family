# ChaqimchiAI Family

Shaffof va oilaviy parental-control monorepo. Mahsulot ota-ona uchun boshqaruv
paneli, bola uchun ko'rinadigan Windows status qatlami hamda ochiq installer
oqimidan iborat. Asosiy mahsulot va dizayn yo'nalishi
[`docs/chaqimchiai-family-loyiha-konsepsiyasi.md`](docs/chaqimchiai-family-loyiha-konsepsiyasi.md)
faylida jamlangan.

## Components

- `server/` — Django + DRF + Channels backend
- `agent/` — Go Windows agent + installer
- `parent-mobile/` — React Native (Expo) parent app
- `parent-web/` — Next.js parent dashboard (real web implementation)
- `parent-ui/` — parent dashboard static visual prototype
- `child-ui/` — ChaqimchiAI Child installer va desktop holatlari static dizayni
- `docs/` — architecture and phase specs

## Product principle

ChaqimchiAI Family yashirin kuzatuv vositasi emas. Bola qanday ma'lumot
olinishi, qoidalar va ekran vaqti holatini ko'ra oladi; ota-ona esa faqat
kelishilgan xavfsizlik ma'lumotlarini boshqaradi.

## Running the backend

```bash
cd server
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

By default it runs against local SQLite and an in-memory Channels layer —
set `DATABASE_NAME`/`DATABASE_USER`/... and `REDIS_URL` env vars for Postgres/Redis.

### Bosqich 0 endpoints

- `POST /api/auth/signup/`, `POST /api/auth/login/`
- `POST /api/enroll/generate-code/` (installer, no auth)
- `POST /api/enroll/verify-code/` (mobile, parent-authenticated)
- `ws/enroll/<device_id>/` — pushes `{"event": "linked"}`

## Running the mobile app

```bash
cd parent-mobile
npm install
npm start
```

## Running the installer (Go)

```bash
cd agent
go mod tidy
go run ./cmd/installer -server http://localhost:8000 -allow-insecure-http
```
