# ChaqimchiAI Family — Arxitektura va Fayllar Tuzilmasi

> Ushbu hujjat repo komponentlarini jamlaydi. Mahsulot roli, dizayn tizimi,
> sahifalar va funksional chegaralarning yangilangan manbasi
> `chaqimchiai-family-loyiha-konsepsiyasi.md`dir.

---

## 1. Yuqori darajali ko'rinish

```
chaqimchi-family/
├── .gitignore
├── README.md
├── .github/
│   └── workflows/
│       ├── server-ci.yml
│       ├── agent-ci.yml
│       └── parent-mobile-ci.yml
├── docs/
│   ├── chaqimchiai-family-loyiha-konsepsiyasi.md
│   ├── chaqimchiai-family-arxitektura.md
│   ├── chaqimchiai-family-ota-ona-dizayn-talablari.md
│   ├── chaqimchiai-family-desktop-dizayn-talablari.md
│   ├── chaqimchiai-family-bola-ilova-dizayn-talablari.md
│   ├── chaqimchiai-family-ornatuvchi-dizayn-talablari.md
│   └── chaqimchiai-family-bosqich0-boshlash-qollanmasi.md
├── server/
├── agent/
├── parent-mobile/
├── parent-web/
├── parent-ui/              # parent dashboard visual prototype
└── agent/webui/               # Child installer/status/block design pages
```

## 2. `server/` — Django backend

Apps: `accounts` (Family, ParentUser), `devices` (ChildDevice, EnrollmentCode, consumers.py), `tracking`, `rules`, `alerts` (keyingi bosqichlar).

## 3. `agent/` — Go agent va installer

`cmd/agent` (SYSTEM service), `cmd/installer` (bir martalik enrollment UI), `internal/enroll|tracker|buffer|sync|rules|ui|service`.

## 4. `parent-mobile/` — React Native

`screens/{auth,enroll,home,activity,alerts,rules,settings}`, `components/`, `api/`, `navigation/`.

Bosqich 0 uchun kerak: `screens/auth/`, `screens/enroll/QRScanScreen.tsx`, `api/auth.ts`, `api/enroll.ts`.

## 5. `parent-web/` va `parent-ui/` — Desktop/web parent dashboard

`parent-web/` — Next.js asosidagi real web ilova. `parent-ui/` esa undan
oldin/yonma-yon ishlatiladigan HTML/CSS vizual prototip: u production API'ga
ulanmaydi, ammo Liquid Glass design system va responsive layout manbasi.

## 6. `agent/webui/` — ChaqimchiAI Child dizayn manbasi

Installerning 5 qadamli oqimi, tray status oynasi, privacy oynasi va ikkita
block holati alohida HTML sahifalarda berilgan. Ular Windows Go agentining
`internal/ui/` implementatsiyasi uchun UX manba hisoblanadi.

## 7. Bosqich 0 uchun kerakli fayllar

**Server:** `config/`, `apps/accounts/`, `apps/devices/` (to'liq).
**Agent:** `cmd/installer/main.go`, `internal/enroll/client.go`.
**Parent-mobile:** `screens/auth/`, `screens/enroll/QRScanScreen.tsx`, `api/auth.ts`, `api/enroll.ts`, `navigation/`.
**Parent-web:** hali yo'q.
