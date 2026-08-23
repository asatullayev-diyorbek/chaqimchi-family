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
