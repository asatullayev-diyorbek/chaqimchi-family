# Agent sync payload v1

`POST /api/tracking/ingest/` batchi quyidagi formatga o‘tadi. Barcha vaqtlar UTC/RFC3339.

```json
{
  "schema_version": 1,
  "device_id": "uuid",
  "batch_id": "uuid",
  "sent_at": "2026-08-03T12:00:00Z",
  "agent": {"version":"1.0.0","platform":"windows","session_id":"uuid"},
  "events": [{"event_id":"uuid","type":"app_usage","occurred_at":"2026-08-03T11:25:00Z","app":"chrome.exe","started_at":"2026-08-03T11:12:30Z","ended_at":"2026-08-03T11:25:00Z","duration_seconds":750}]
}
```

`batch_id` qayta yuborilganda backend idempotent javob beradi. `event_id` event darajasidagi audit identifikatori; v1 transition davrida eski agentlar uchun ixtiyoriy, keyingi agent relizida majburiy qilinadi.

## `browser_domain` eventi

Backend bu turni allaqachon qabul qiladi va `GET /api/tracking/sites/<device_id>/`
orqali qaytaradi; agent hozircha yubormaydi. Kutilayotgan shakl:

```json
{"event_id":"uuid","type":"browser_domain","occurred_at":"2026-08-30T11:25:00Z",
 "domain":"youtube.com","started_at":"2026-08-30T11:12:30Z",
 "ended_at":"2026-08-30T11:25:00Z","duration_seconds":750}
```

- `domain` yoki `url` — bittasi yetarli. `url` berilsa backend faqat host qismini
  oladi, qolgan yo'l va query saqlanmaydi.
- Host bitta ko'rinishga keltiriladi: kichik harf, `www.` va port olib tashlanadi,
  ya'ni `www.YouTube.com` va `youtube.com:443` bitta qator bo'ladi.
- Hostni ajratib bo'lmasa event tashlab yuboriladi — "unknown" qatori yaratilmaydi.
- `duration_seconds` bo'lmasa `started_at`/`ended_at` farqi ishlatiladi.

Saytlar **qurilma bo'yicha** o'qiladi: bir farzandning ikki qurilmasidagi vaqt
qo'shilmaydi, chunki ular bir vaqtda ishlatilsa ikki marta sanalgan bo'lardi.
