# ChaqimchiAI Family — Bosqich 0: Backend + Enrollment Boshlash Ko'rsatmasi

> **Qamrov:** faqat enrollment (qurilmani oila hisobiga bog'lash). To'liq parent dashboard bu bosqichga kirmaydi — faqat login/signup va "Qurilma qo'shish" (QR skaner) ekrani kerak.

## Ma'lumotlar modeli

`accounts.Family`, `accounts.ParentUser` (family FK, email, password_hash).
`devices.ChildDevice` (uuid pk, family FK nullable, child_name, status unlinked/linked, device_secret, linked_at).
`devices.EnrollmentCode` (device FK, code 6 xonali unique, qr_payload, expires_at, used).

## Endpointlar

- `POST /api/enroll/generate-code/` — auth yo'q, ChildDevice(unlinked) + EnrollmentCode yaratadi.
- `POST /api/enroll/verify-code/` — parent auth talab qiladi, kodni tekshiradi, deviceni familyga bog'laydi, status=linked, used=True.
- `ws/enroll/<device_id>/` — Django Channels, linked bo'lganda `{"event": "linked"}` yuboradi.

## Qabul qilish mezonlari

- generate-code → unlinked ChildDevice + EnrollmentCode yaratiladi
- muddati tugagan kod rad etiladi (410/404)
- muvaffaqiyatli verify-code → family to'g'ri o'rnatiladi, status=linked
- ishlatilgan kod qayta ishlatilmaydi
- WebSocket orqali linked signali yetib boradi
- to'liq oqim: login → QR skaner → "✓ Bog'landi"

## Keyingi qadam

Bosqich 1: Tracking + Buffer/Sync halqasi.
