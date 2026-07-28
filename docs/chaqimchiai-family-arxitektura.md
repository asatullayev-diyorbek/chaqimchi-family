# ChaqimchiAI Family — To'liq Fayllar Tuzilmasi

> Bu hujjat butun repo bo'yicha (`chaqimchi-family`) barcha komponentlarning papka/fayl tuzilmasini bir joyga jamlaydi: backend (server), agent (Windows, Go), installer va parent tomoni (mobil + web). Monorepo tamoyili `chaqimchi-guard`dagi bilan bir xil — faqat ichidagi komponentlar boshqacha.

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
│   ├── chaqimchiai-family-arxitektura.md
│   ├── chaqimchiai-family-ota-ona-dizayn-talablari.md
│   ├── chaqimchiai-family-desktop-dizayn-talablari.md
│   ├── chaqimchiai-family-bola-ilova-dizayn-talablari.md
│   ├── chaqimchiai-family-ornatuvchi-dizayn-talablari.md
│   └── chaqimchiai-family-bosqich0-boshlash-qollanmasi.md
├── server/
├── agent/
├── parent-mobile/
└── parent-web/
```

## 2. `server/` — Django backend

Apps: `accounts` (Family, ParentUser), `devices` (ChildDevice, EnrollmentCode, consumers.py), `tracking`, `rules`, `alerts` (keyingi bosqichlar).

## 3. `agent/` — Go agent va installer

`cmd/agent` (SYSTEM service), `cmd/installer` (bir martalik enrollment UI), `internal/enroll|tracker|buffer|sync|rules|ui|service`.

## 4. `parent-mobile/` — React Native

`screens/{auth,enroll,home,activity,alerts,rules,settings}`, `components/`, `api/`, `navigation/`.

Bosqich 0 uchun kerak: `screens/auth/`, `screens/enroll/QRScanScreen.tsx`, `api/auth.ts`, `api/enroll.ts`.

## 5. `parent-web/` — Desktop/web dashboard

Bosqich 2'da qurila boshlaydi, Bosqich 0'da yo'q.

## 6. Bosqich 0 uchun kerakli fayllar

**Server:** `config/`, `apps/accounts/`, `apps/devices/` (to'liq).
**Agent:** `cmd/installer/main.go`, `internal/enroll/client.go`.
**Parent-mobile:** `screens/auth/`, `screens/enroll/QRScanScreen.tsx`, `api/auth.ts`, `api/enroll.ts`, `navigation/`.
**Parent-web:** hali yo'q.
