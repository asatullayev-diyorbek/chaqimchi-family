# Agent yangilash — qo'lda va diagnostika

Sana: 2026-09-04. Kontekst: `agent-v0.5.0` OTA release chiqarildi
(`is_active=True`, `GET /api/deploy/latest/` → 200 tekshirildi), lekin
Windows'dagi `0.4.0-rc.5` agent reboot'dan keyin ham `0.5.0` ga o'tmadi va
serverga `agent_updated` / `agent_update_failed` event yubormadi. OTA yo'lida
jimgina xatolik bor — sabab faqat `agent.log` da.

Release: <https://github.com/asatullayev-diyorbek/chaqimchi-family/releases/tag/agent-v0.5.0>
Asset: `chaqimchi-agent.exe` — SHA-256 `ae24e541aaffb926f59c6cf7fb935223f95367832bf9045dddf30dbb6f1108d9`

---

## OTA qanday ishlaydi (eslatma)

`agent/internal/updater`:

1. **Poll** — start'da bir marta + har 6 soatda: `GET /api/deploy/latest/`
   (Device auth) → `{version, binary_url, sha256, signature, mandatory}`.
2. **Compare** — `IsNewer(currentVersion, latest)`. `0.5.0 > 0.4.0-rc.5` → davom.
3. **Download** — `binary_url` (GitHub release asset, 302 → githubusercontent).
4. **Verify** — sha256 mos + Ed25519 imzo pinned pubkey `fcdbbef0…` bilan.
5. **Smoke-test** — yangi `.exe` `-selftest` bilan ishlaydi, `exit 0` kerak.
6. **Swap** — `chaqimchi-agent.exe → agent.old.exe`, yangisi → `chaqimchi-agent.exe`;
   `service.RestartSelf()` (`os.Exit(1)` → SCM recovery restart).
7. **Confirm** — yangi binariy birinchi muvaffaqiyatli sinxrondan so'ng
   "confirmed"; `agent_updated` event.
8. **Rollback** — crash-loop yoki probe oynasida tasdiqlanmasa keyingi start'da
   `agent.old.exe` tiklanadi + `agent_update_failed` event.

Xato **1–5** bosqichlarda faqat `agent.log` ga yoziladi (serverga event yo'q).

---

## 1. Qo'lda majburlash

### A. Service restart (avtomatik tekshiruvni qo'zg'atadi)

```powershell
# Administrator PowerShell
Restart-Service ChaqimchiFamilyAgent
```

Agent start'da darrov `/api/deploy/latest/` ni so'raydi.

### B. Binariyni qo'lda almashtirish (OTA'ni chetlab, kafolatli)

```powershell
# Administrator PowerShell
Stop-Service ChaqimchiFamilyAgent

$exe = "C:\Program Files\ChaqimchiAI\chaqimchi-agent.exe"
Copy-Item $exe "$exe.bak" -Force
curl.exe -L "https://github.com/asatullayev-diyorbek/chaqimchi-family/releases/download/agent-v0.5.0/chaqimchi-agent.exe" -o $exe

# tekshirish — quyidagi hash chiqishi kerak:
(Get-FileHash $exe -Algorithm SHA256).Hash
# ae24e541aaffb926f59c6cf7fb935223f95367832bf9045dddf30dbb6f1108d9

Start-Service ChaqimchiFamilyAgent
```

Xato bo'lsa qaytarish: `Copy-Item "$exe.bak" $exe -Force; Restart-Service ChaqimchiFamilyAgent`.

Keyin: Dashboard → Qurilmalar → `agent_version` = **0.5.0**; ~5 daqiqada
Faoliyat → **Web-saytlar** da domenlar.

---

## 2. Diagnostika — nega OTA o'tmayapti

### Agent log

```powershell
Get-Content "C:\ProgramData\ChaqimchiFamily\agent.log" -Tail 60
```

Qidiriladigan satrlar:

| Log satri | Ma'nosi |
|---|---|
| `update available: 0.4.0-rc.5 -> 0.5.0` | poll ishladi, update topildi |
| `applying update 0.5.0: downloading update: ...` | GitHub yuklab olish xatosi (tarmoq/proxy) |
| `applying update 0.5.0: <sha256/signature> ...` | verify xatosi (asset buzuq yoki eski) |
| `new binary failed smoke test: ...virus...` yoki `Access is denied` | **Defender yangi `.exe` ni bloklayapti** (imzolanmagan Go binariy) |
| `applying update 0.5.0: moving current binary aside: Access is denied` | `C:\Program Files\ChaqimchiAI\` ga yozib bo'lmadi |
| Hech qanday `update available` satri yo'q | poll `/api/deploy/latest/` ga yeta olmadi (tarmoq / DNS / vaqt) |

### Defender bloklashini tekshirish

```powershell
Get-MpThreat | Select-Object -First 5
Get-MpThreatDetection | Select-Object -First 5 ActionSuccess, Resources
```

Agar `chaqimchi-agent` ga tegishli threat bo'lsa — vaqtincha yechim: build
mashinasida `C:\Program Files\ChaqimchiAI` ni Defender istisnosiga qo'shish
(`Add-MpPreference -ExclusionPath "C:\Program Files\ChaqimchiAI"`), yoki
binariyni Authenticode bilan imzolash (uzoq muddatli yechim — `docs/windows-distribution.md`).

### Poll ishlayotganini serverdan tekshirish

Endpoint jonli (tasdiqlangan):

```
GET https://api.guard.chaqimchi-ai.uz/api/deploy/latest/
Authorization: Device <device_id>:<device_secret>
→ 200 {"version":"0.5.0", ...}
```

---

## 3. Aniqlangan sabab + kod tuzatishlari — 2026-09-04

Real diagnostika (`agent.log`):

```
13:01:01  update available: 0.4.0-rc.5 -> 0.5.0        ← poll ISHLADI
13:04:18  applying update 0.5.0: reading update body:
          read tcp ...->185.199.108.133:443: wsarecv:
          An existing connection was forcibly closed    ← GitHub yuklab olish uzildi
```

**Defender emas.** `Get-MpThreat` faqat eski Inno `Setup.exe`ni ko'rsatadi;
agent binariysi toza. Sabab: **transient tarmoq uzilishi** GitHub asset
yuklashda + retry yo'q + serverga event yo'q.

Bundan tashqari, `0.5.0`ni qo'lda o'rnatgach ma'lum bo'ldi: **brauzer tarixi
umuman yig'ilmaydi** — bu alohida, chuqurroq xato (Bug #3 turkumidan).

### Tuzatildi (commit — quyida)

1. **`updater.download()` — retry** (`apply_windows.go`): 3 urinish, backoff bilan.
   Tarmoq xatosi / mid-stream uzilish / 5xx / 429 → qayta urinadi; 4xx → yo'q.
   `TestDownload_*` (3 test) — mid-stream drop → 3-urinishda tiklanadi.
2. **Apply xatosi serverga bildiriladi** (`cmd/agent/main.go`): download / verify
   / smoke xatosi endi `reportAgentEvent("agent_update_failed", ...)` yuboradi
   (avval faqat `rollback()` yuborardi → stuck update dashboard'da ko'rinmasdi).
3. **Brauzer tarixi Session 0 xatosi** (`browser_history_windows.go`):
   `os.Getenv("LOCALAPPDATA")` SYSTEM xizmati uchun
   `C:\Windows\System32\config\systemprofile\AppData\Local` — bola profili emas.
   Endi `C:\Users\*` bo'ylab yuriladi (SYSTEM har bir foydalanuvchi faylini
   o'qiy oladi); checkpoint kaliti `<user>/<browser>/<profile>`. Diagnostika
   uchun start'da log: `browser history: N user profile(s), M history DB(s) found`.
   Real natija (0.5.1-dev): `1 user profile(s), 4 history DB(s)`, `238 visit(s) recorded`.

Uzoq muddatli (ochiq): **Authenticode imzo** (`docs/windows-distribution.md`),
va `0.5.1` OTA release'ni macOS'dan imzolab chiqarish (bu tuzatishlar bilan).
