# ChaqimchiAI Family

Parental-control monorepo. Bosqich 0 (current): device enrollment flow only —
installer shows a code/QR, parent app scans it, both sides see "linked".

## Components

- `server/` — Django + DRF + Channels backend
- `agent/` — Go Windows agent + installer
- `parent-mobile/` — React Native (Expo) parent app
- `parent-web/` — Next.js dashboard (not built until Bosqich 2)
- `docs/` — architecture and phase specs

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
go run ./cmd/installer -server http://localhost:8000
```
