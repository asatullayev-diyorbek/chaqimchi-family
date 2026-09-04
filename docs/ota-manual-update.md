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

## 3. OTA'ni kodda mustahkamlash (keyingi ish)

`agent/internal/updater/apply_windows.go`:

- **Apply xatosini serverga bildirish** — hozir download/verify/smoke xatolari
  faqat `log.Printf` bo'ladi. `reportAgentEvent("agent_update_failed", err)`
  chaqirilsa, dashboard'dan ko'rinardi (hozir faqat `rollback()` yuboradi).
- **Defender bilan kelishuv** — smoke-test'dan oldin `Unblock-File` ekvivalenti
  yoki yangi `.exe` ni Program Files ichida yozib, keyin ishga tushirish.
- Uzoq muddatli: **Authenticode imzo** (`docs/windows-distribution.md` §"Code
  signing mavjud bo'lgach").
