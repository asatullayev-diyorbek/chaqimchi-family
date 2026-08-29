# Agent OTA update

Sana: 2026-08-30

Guard agenti foydalanuvchi kompyuteriga tegmasdan, masofadan yangilanadi.
Yangilash **sokin** (Chrome uslubi) — bola bloklay olmaydi; ota-ona qurilma
sahifasida ishlab turgan versiyani ko'radi.

## Oqim

```
Django admin: yangi AgentVersion (version, binary_url, sha256, signature)
        │
agent (har 6 soatda)  GET /api/deploy/latest/   [Device auth]
        │  IsNewer? ha
        ▼
download binary  →  VerifyBinary (sha256 + Ed25519, pinned key)  →  FAIL → tashlab yuboriladi
        │  OK
        ▼
smoke test:  agent.new.exe -selftest   (exit 0 bo'lishi shart)
        │  OK
        ▼
update.json = {stage: staged}  →  rename agent.exe → agent.old.exe  →  rename new → agent.exe
        │  stage: swapped
        ▼
service.RestartSelf()  (os.Exit 1)  →  SCM recovery yangi binarni ishga tushiradi
        │
yangi binar startda:  ResolvePending → stage: probing
        │
birinchi muvaffaqiyatli /api/tracking/ingest/  →  ConfirmHealthy
        │  agent.old.exe o'chiriladi, agent_updated event, update.json tozalanadi
        ▼
tamom
```

## Yaxlitlik

- **Ed25519 pinned key** — `agent/internal/updater/pubkey.go` da public key.
  Private key faqat sekret sifatida (`agent/.secrets/update-signing.key`,
  gitignored). Agent almashtirishdan **oldin** `sha256` va imzoni tekshiradi
  (`verify.go`). Imzosiz yoki mos kelmaydigan binar hech qachon diskка
  yozilmaydi.
- **Downgrade himoyasi** — `Apply` joriy versiyadan yangi bo'lmagan versiyani rad etadi.
- Authenticode/code-signing sertifikati YO'Q (CT-08 "unsigned MVP"). Ed25519
  update kanalini himoya qiladi (buzilgan backend / MITM), lekin OS trust
  (SmartScreen/Defender) alohida masala — sertifikat olinganда qo'shiladi.

## Rollback

`internal/updater/state.go` → `decideResolve` (pure, testли):

| Holat | Harakat |
|---|---|
| swap bo'ldi, lekin yangi versiya ishga tushmadi | eski binarni tiklash, exit |
| yangi binar 3 martadan ko'p qayta ishga tushdi (crash loop) | rollback |
| 15 daqiqada "healthy" tasdiqlanmadi | rollback |
| rollback tugadi | `agent_update_failed` event, `agent.failed.exe` o'chiriladi |

**"Umuman ishga tushmaydi"** holati (masalan noto'g'ri arxitektura, buzuq
build): smoke test (`-selftest`) buni swap'dan **oldin** tutadi. Qolgan xavf
uchun — staged rollout: avval bitta test qurilmага chiqarish, u yangi
versiyani dashboard'da ko'rsatgach `is_active` ni hammага qoldirish.

## Release chiqarish

```bash
scripts/updates/publish-agent-release.sh 0.5.0
```

Skript: `windows/amd64` agent.exe ni `-X main.version=0.5.0` bilan quradi →
`relsign sign` → `gh release create agent-v0.5.0` → sha256 + signature +
asset URL ni chop etadi. Keyin Django admin (`/admin/deploy/agentversion/`)
da AgentVersion qo'shasiz.

**Bitta test qurilmасида sinang**, u `agent_version=0.5.0` ni dashboard'да
ko'rsatgach kенг chiqaring.

## Kalitni almashtirish (MUHIM)

Hozirgi imzolash kaliti **development paytida yaratilgan** va bir marta
transcript'да ko'ringan. Har qanday haqiqiy public release'dan oldin:

```bash
cd agent && go run ./cmd/relsign genkey        # maxfiy joyda bajaring
# public key → agent/internal/updater/pubkey.go
# private key → sekret menejer (masalan GitHub Actions secret)
```

Kalit almashса, undan oldingi versiyadagi agentlar yangilana olmaydi —
ular avval eski kalit bilan imzolangan oraliq release orqali yangi
`pubkey.go` ga o'tishi kerak. Shuning uchun kalitni faqat zarurат bo'lганда
almashtiring.

## Fayllar

| Fayl | Vazifa |
|---|---|
| `agent/internal/updater/checker.go` | `/api/deploy/latest/` polling, versiya solishtirish |
| `agent/internal/updater/verify.go` | sha256 + Ed25519 tekshiruv |
| `agent/internal/updater/pubkey.go` | pinned public key |
| `agent/internal/updater/state.go` | rollback qaror mantiqi (pure) |
| `agent/internal/updater/apply_windows.go` | download, smoke test, swap, rollback I/O |
| `agent/cmd/relsign/` | kalit yaratish + release imzolash |
| `scripts/updates/publish-agent-release.sh` | build + sign + gh release |
| `server/apps/deploy/` | `AgentVersion` model + admin + `/api/deploy/latest/` |
```
