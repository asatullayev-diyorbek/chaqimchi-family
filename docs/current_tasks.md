# ChaqimchiAI Guard — Current Tasks

Sana: 2026-08-11  
Holat: rejalashtirish  
Asosiy maqsad: GUI bilan ishlaydigan, production API’ga ulangan va Windows 10/11’da tekshirilgan `ChaqimchiAI Guard Setup.exe` release candidate tayyorlash.

## Ishlash qoidasi

- Vazifalar quyidagi tartibda bajariladi.
- Har bosqich keyingi bosqichga o‘tishdan oldin o‘z checkpointidan o‘tishi kerak.
- Checkpoint o‘tmasa, public release qilinmaydi; muammo qayd etilib, alohida tuzatish vazifasi ochiladi.
- Agent, bootstrap yoki boshqa ichki `.exe` fayllar public tarqatilmaydi. Foydalanuvchiga faqat `ChaqimchiAI Guard Setup.exe` beriladi.
- Production’da faqat HTTPS ishlatiladi. Defender, SmartScreen, Firewall yoki UAC’ni o‘chirish tavsiya qilinmaydi.

## Hozirgi holat — 2026-08-23 yangilanishi

- [x] Backend PythonAnywhere Free tarifda joylashtirildi: `https://apiguard.pythonanywhere.com` (health check PASS, CORS PASS).
- [x] Frontend (parent-web) GitHub'ga push qilindi va Vercel'ga ulandi: `https://chaqimchi-family-parent-web.vercel.app` (production, git auto-deploy yoqilgan).
- [~] Custom domen (`api.guard.chaqimchi-ai.uz`) hali PA Free tarifga ulanmagan — Cloudflare Worker orqali Host-rewrite proxy rejalashtirilgan, keyingi qadam.
- [ ] PA Free web app 3 oyda bitta qo‘lda "Run until 3 months" bosilishi kerak (dashboard orqali) — API bu ishni bajara olmaydi.
- [ ] Vercel loyihasida Root Directory dashboard'da `parent-web` ga qo‘lda o‘rnatilishi kerak (CLI buni sozlay olmaydi).

## Eski holat

- [x] Eski console-subsystem installerlar `releases/windows/archive/` ichiga ko‘chirildi.
- [x] GUI bootstrap test build yaratildi.
- [x] Bootstrap va desktop buildlari uchun GUI subsystem tekshiruvi qo‘shildi.
- [x] Final Inno Setup installer uchun GUI subsystem gate qo‘shildi.
- [x] Windows target uchun Go package’lar compile tekshiruvdan o‘tdi.
- [ ] Production API domeni real internetdan ishlashi tasdiqlanmagan.
- [ ] To‘liq Inno Setup installer Windows’da build qilinmagan.
- [ ] Installer real Windows 10/11 muhitida end-to-end test qilinmagan.
- [ ] Release security va distribution gate’laridan o‘tmagan.
- [~] CT-01 tekshirildi: Cloudflare nameserverlar faol, root/`www` yozuvlari bor, ammo frontend origin `502` qaytaryapti va `api.guard` DNS recordi public resolver’da ko‘rinmayapti.
- [~] CT-02 audit boshlandi: client va backend production URL’lari hali ngrok/fallback qiymatlarida.
- [~] CT-03 development uchun yetarli deb belgilandi; Windows release validation bosqichigacha deferred.
- [x] CT-04 RC versiyasi va changelog qarori belgilandi: `0.4.0-rc.1`.
- [~] CT-05 faqat preflight audit qilindi; actual build/test Windows muhitiga qoldirildi.

---

## CT-01 — Production domenlar sxemasini yakunlash

**Vazifa:** loyiha ishlatadigan rasmiy frontend, API va keyingi update domenlarini aniq belgilash.

**Goal:** barcha komponentlar bitta kelishilgan domen sxemasidan foydalanishi va eski/ngrok hostname’lar production oqimiga aralashmasligi.

**Tavsiya etilgan sxema:**

- Web: `https://chaqimchi-ai.uz`
- Web alias: `https://www.chaqimchi-ai.uz`
- API: `https://api.guard.chaqimchi-ai.uz`
- Update kanali, keyingi bosqich: `https://update.chaqimchi-ai.uz`

**Qanday bajarish mumkin:**

1. Cloudflare DNS Records ichida root, `www` va `api` yozuvlarini ko‘rib chiqish.
2. Root va `www` yozuvlarini frontend hostingga yo‘naltirish.
3. `api` yozuvini Django backend ishlaydigan server yoki tunnel/proxy’ga yo‘naltirish.
4. Cloudflare SSL/TLS rejimini backend sertifikatiga qarab `Full (strict)` qilish.
5. Eski `chaqimchiai.uz` va ngrok manzillari production hujjatlari yoki environment konfiguratsiyasida ishlatilmasligini audit qilish.

**Checkpoint CT-01:**

- [ ] `chaqimchi-ai.uz` public DNS orqali resolve bo‘ladi.
- [ ] `www.chaqimchi-ai.uz` public DNS orqali resolve bo‘ladi.
- [ ] `api.guard.chaqimchi-ai.uz` public DNS orqali resolve bo‘ladi.
- [ ] Uchala kerakli hostda TLS sertifikati valid.
- [ ] `https://api.guard.chaqimchi-ai.uz/api/health/` HTTP 200 qaytaradi.
- [ ] API javobida Cloudflare yoki hosting xato sahifasi emas, Django health javobi keladi.

**Done mezoni:** frontend va API internetdan barqaror HTTPS orqali ochiladi; production uchun yagona canonical hostname yozib qo‘yilgan.

### CT-01 bajarilish natijasi — 2026-08-11

Public DNS tekshiruvi `1.1.1.1` orqali bajarildi:

- `chaqimchi-ai.uz` → `104.21.90.3`, `172.67.150.128` (Cloudflare proxy IP’lari).
- `www.chaqimchi-ai.uz` → `104.21.90.3`, `172.67.150.128` (Cloudflare proxy IP’lari).
- `chaqimchi-ai.uz` nameserverlari → `ali.ns.cloudflare.com`, `yadiel.ns.cloudflare.com`.
- `api.guard.chaqimchi-ai.uz` → public resolver’da A yoki CNAME record topilmadi.
- `https://chaqimchi-ai.uz` → HTTP `502`.
- `https://www.chaqimchi-ai.uz` → HTTP `502`.
- `https://api.guard.chaqimchi-ai.uz/api/health/` → DNS resolve bo‘lmadi.

**CT-01 holati:** `BLOCKED`.

**Blocker:** Cloudflare zone faol, lekin frontend uchun origin hozir javob bermayapti; `api.guard` subdomain recordi public DNS’da ko‘rinmayapti yoki unga mos backend origin hali ulanmagan.

**Keyingi amaliy ish:** Cloudflare DNS’da `api.guard` recordini backend server/proxy’ga qo‘shish, root/`www` originni ishlaydigan frontend hostingga ulash va keyin CT-01 checkpointlarini qayta tekshirish.

---

## CT-02 — Production API konfiguratsiyasini tasdiqlash

**Vazifa:** frontend, mobil ilova, backend va Windows installer bir xil production API URL’dan foydalanishini ta’minlash.

**Goal:** login, enrollment, tracking va installer oqimlari `https://api.guard.chaqimchi-ai.uz` orqali ishlashi.

**Qanday bajarish mumkin:**

1. Frontend production environment qiymatini tekshirish: `NEXT_PUBLIC_API_URL`.
2. Mobil build environment qiymatini tekshirish: `EXPO_PUBLIC_API_URL`.
3. Backend public URL qiymatini tekshirish: `CHAQIMCHI_PUBLIC_API_URL`.
4. Backend CORS va CSRF trusted origin ro‘yxatida root va `www` domenlari borligini tekshirish.
5. Installer build parametri sifatida aynan `https://api.guard.chaqimchi-ai.uz` berilishini tasdiqlash.
6. Production konfiguratsiyada `localhost`, private IP yoki ngrok fallback ishlatilmayotganini tekshirish.

**Checkpoint CT-02:**

- [ ] Web login production API’ga so‘rov yuboradi.
- [ ] CORS xatosi yo‘q.
- [ ] Backend public URL to‘g‘ri download/enrollment URL hosil qiladi.
- [ ] Installer ichidagi server URL HTTPS va canonical API hostga teng.
- [ ] Maxfiy environment qiymatlari repo yoki build logiga chiqmagan.

**Done mezoni:** barcha production clientlar bir API hostdan foydalanadi va browser/API xavfsizlik sozlamalari mos.

### CT-02 audit natijasi — 2026-08-11

- `parent-web/.env.local` → `https://ora-splittable-illuminatedly.ngrok-free.dev`.
- `parent-mobile/.env` → `https://ora-splittable-illuminatedly.ngrok-free.dev`.
- Backend `CHAQIMCHI_PUBLIC_API_URL` environment orqali berilmasa, eski ngrok fallback’dan foydalanadi.
- Windows build script defaulti eski `https://api.chaqimchiai.uz` qiymatida; canonical production host emas.
- Django CORS default ro‘yxatida `https://chaqimchi-ai.uz` va `https://www.chaqimchi-ai.uz` mavjud.
- `api.guard.chaqimchi-ai.uz` public DNS’da hali resolve bo‘lmagani sabab API health va production login tekshiruvi bajarilmadi.

**CT-02 holati:** `IN PROGRESS / BLOCKED`.

**Blocker:** `api.guard.chaqimchi-ai.uz` DNS va backend origin tayyor emas; mavjud client/backend environment’lar production canonical hostga o‘tkazilmagan.

**Keyingi amaliy ish:** Cloudflare’da `api.guard` record targetini ulash, keyin web/mobile/backend production environment’larini `https://api.guard.chaqimchi-ai.uz` ga almashtirish va CT-02 checkpointlarini qayta tekshirish.

---

## CT-03 — Windows release muhitini tayyorlash

**Vazifa:** toza Windows release mashinasi yoki VM tayyorlash.

**Goal:** installer buildi takrorlanuvchi va hujjatlashtirilgan muhitda yig‘ilishi.

**Qanday bajarish mumkin:**

1. Windows 11 x64 release VM tayyorlash; imkon bo‘lsa alohida Windows 10 x64 test VM ham tayyorlash.
2. Git va loyihaning mos Go versiyasini o‘rnatish.
3. Inno Setup 6 ni o‘rnatish va `iscc.exe` mavjudligini tekshirish.
4. `goversioninfo` vositasini o‘rnatish.
5. Signing rejalashtirilsa, Windows SDK va `signtool.exe` ni tayyorlash.
6. Repo’ni clean checkout orqali release mashinasiga olish.
7. Build boshlanishidan oldin ishlatiladigan commit hash va build vaqtini qayd etish.

**Checkpoint CT-03:**

- [ ] `go version` kutilgan versiyani ko‘rsatadi.
- [ ] `iscc.exe` command line’dan ishlaydi.
- [ ] `goversioninfo.exe` command line’dan ishlaydi.
- [ ] Repo clean checkout holatida.
- [ ] Release mashinasida oldingi installer qoldiqlari buildga aralashmaydi.

**Done mezoni:** bitta PowerShell build buyrug‘ini ishga tushirishga tayyor Windows muhiti mavjud.

### CT-03 audit natijasi — 2026-08-11

- Host: macOS ARM64 (`Darwin`, Apple Silicon).
- Go: `go1.26.5` mavjud; `GOOS=windows`, `GOARCH=amd64` cross-compile mumkin.
- Inno Setup `iscc.exe`: topilmadi.
- `goversioninfo.exe`: topilmadi.
- `signtool.exe`: topilmadi.
- Repo clean checkout emas; hozirgi worktree’da 88 ta mavjud o‘zgarish bor.

**CT-03 holati:** `DEFERRED FOR RELEASE VALIDATION`.

**Izoh:** hozirgi macOS ARM64 muhit development, cross-compile va kod/test ishlari uchun yetarli. Windows 10/11 x64 muhit faqat to‘liq Inno Setup buildi, GUI runtime, Windows Service, UAC, uninstall va SmartScreen/Defender tekshiruvlari uchun talab qilinadi.

**Keyingi amaliy ish:** development bosqichida CT-04 va keyingi kod/API ishlarini davom ettirish. Release candidate tayyor bo‘lganda Windows release VM/mashinasini tayyorlash, Inno Setup 6 va `goversioninfo` o‘rnatish, keyin CT-03 checkpointlarini qayta tekshirish.

---

## CT-04 — Versiya va release candidate nomini belgilash

**Vazifa:** test artifactlar va public release uchun aniq versiyalash qarorini qabul qilish.

**Goal:** eski `v1/v2/v3` test fayllari bilan yangi professional installer aralashib ketmasligi.

**Tavsiya:** ichki test uchun `0.4.0-rc.1`, barcha gate’lardan o‘tgach public MVP uchun `0.4.0`.

**Qanday bajarish mumkin:**

1. Release versiyasini tasdiqlash.
2. Release candidate va final release farqini yozib qo‘yish.
3. Windows File Version to‘rtta son talab qilsa `0.4.0.0`, foydalanuvchi ko‘radigan product version uchun `0.4.0` ishlatish.
4. `CHANGELOG.md` uchun installer GUI fix, GUI gate va production API o‘zgarishlarini tayyorlash.
5. Public fayl nomini versiyasiz barqaror saqlash: `ChaqimchiAI Guard Setup.exe`.

**Checkpoint CT-04:**

- [ ] RC versiya tasdiqlangan.
- [ ] Final MVP versiya tasdiqlangan.
- [ ] Changelog mazmuni tayyor.
- [ ] Public va ichki artifact nomlari aniq ajratilgan.

**Done mezoni:** build jarayoniga beriladigan versiya va release nomlash siyosati bo‘yicha noaniqlik qolmagan.

### CT-04 bajarilish natijasi — 2026-08-11

- RC versiya: `0.4.0-rc.1`.
- Rejalashtirilgan public MVP: `0.4.0`.
- `CHANGELOG.md` yaratildi va RC cheklovlari qayd qilindi.
- Eski `v1/v2/v3` fayllar test artifactlari sifatida qaraladi, semver release emas.
- Git tag hozircha yaratilmaydi; avval CT-01, CT-02 va Windows release checkpointlari yakunlanadi.

**CT-04 holati:** `COMPLETED`.

---

## CT-05 — To‘liq Inno Setup installer build qilish

**Vazifa:** Windows release mashinasida professional installer yig‘ish.

**Goal:** foydalanuvchiga tarqatiladigan yagona GUI installer hosil qilish.

**Qanday bajarish mumkin:**

1. CT-01 va CT-02’dan o‘tgan canonical API URL’ni olish.
2. `scripts/windows/build-guard-setup.ps1` ni tanlangan RC versiya va API URL bilan ishga tushirish.
3. Script yaratgan agent, bootstrap va desktop EXE metadata/icon’larini tekshirish.
4. Inno Setup compile natijasini `releases/windows/ChaqimchiAI Guard Setup.exe` sifatida olish.
5. Build logini saqlash.
6. Final installerga SHA-256 hisoblash va build manifestga yozish.

**Checkpoint CT-05:**

- [ ] PowerShell build xatosiz yakunlangan.
- [ ] `ChaqimchiAI Guard Setup.exe` mavjud.
- [ ] Bootstrap, desktop va final installer GUI subsystem gate’dan o‘tgan.
- [ ] Installer iconi va Windows metadata bo‘sh emas.
- [ ] Embedded backend URL `https://api.guard.chaqimchi-ai.uz`.
- [ ] Buildda UPX yoki boshqa packer ishlatilmagan.
- [ ] SHA-256 hash qayd etilgan.

**Done mezoni:** real Windows’da ishga tushirish uchun tayyor, lekin hali public qilinmagan RC installer mavjud.

### CT-05 preflight audit natijasi — 2026-08-11

- Build script mavjud.
- Inno Setup script mavjud.
- Brend iconi mavjud.
- Embedded agent payload mavjud; uning console subsystem holati normal, chunki release script uni `-H=windowsgui` bilan qayta build qiladi.
- PowerShell, Inno Setup `iscc.exe` va `goversioninfo.exe` macOS development muhitida mavjud emas.
- Build script defaultida eski hostname bor; Windows build vaqtida canonical parametr majburiy ishlatiladi:

```powershell
.\scripts\windows\build-guard-setup.ps1 `
  -Version 0.4.0-rc.1 `
  -ServerUrl https://api.guard.chaqimchi-ai.uz
```

**CT-05 holati:** `DEFERRED FOR WINDOWS BUILD`.

**Izoh:** CT-05 macOS’da test qilinmadi va test qilingan deb hisoblanmaydi. Hozirgi audit faqat buildga kiradigan fayllar va muhim parametrlarni ko‘rib chiqdi. To‘liq installer faqat Windows release mashinasida yig‘iladi va o‘sha yerda tekshiriladi.

**Keyingi amaliy ish:** Windows release muhitida yuqoridagi command bilan RC installer build qilish, final GUI gate va SHA-256 natijasini qayd etish.

---

## CT-06 — Installer GUI oqimini Windows’da test qilish

**Vazifa:** RC installer’ni toza Windows 10/11 muhitida qo‘lda sinash.

**Goal:** o‘rnatish, rozilik, enrollment, service va uninstall oqimlari foydalanuvchi ko‘radigan tarzda to‘liq ishlashi.

**Qanday bajarish mumkin:**

1. Avval Windows 11 clean snapshot’da installer’ni oddiy double-click bilan ishga tushirish.
2. Welcome, transparency/consent, install progress va finish oynalarini tekshirish.
3. QR-kod va 6 xonali kod oynasini tekshirish.
4. Parent ilova orqali real enrollment bajarish.
5. Kod expiration, bekor qilish va internet yo‘q holatlarini alohida sinash.
6. `services.msc` orqali Guard Service holatini tekshirish.
7. Desktop/tray holati va xatolik MessageBox’larini tekshirish.
8. Rebootdan so‘ng service qayta ishga tushishini tekshirish.
9. Uninstall qilib service, program files va ruxsat etilgan local data tozalanganini tekshirish.
10. Shu testlarni Windows 10’da takrorlash.

**Checkpoint CT-06:**

- [ ] Installer console oynasisiz GUI sifatida ochiladi.
- [ ] Rozilik olinmasdan enrollment boshlanmaydi.
- [ ] QR-kod to‘g‘ri render bo‘ladi va skanerlanadi.
- [ ] 6 xonali kod o‘qiladi va ishlaydi.
- [ ] Kod muddati tugaganda yangi kod oqimi ishlaydi.
- [ ] Bekor qilish ilovani xavfsiz yopadi.
- [ ] Internet/API xatosi foydalanuvchiga tushunarli ko‘rsatiladi.
- [ ] Enrollment muvaffaqiyatli yakunlanadi.
- [ ] Guard Service `Running` holatida.
- [ ] Rebootdan keyin service qayta ishlaydi.
- [ ] Uninstall muvaffaqiyatli va xizmat qoldig‘i qolmaydi.
- [ ] Windows 10 va Windows 11 natijalari qayd etilgan.

**Done mezoni:** barcha kritik GUI va lifecycle testlar PASS; topilgan muammolar screenshot/log bilan alohida vazifaga aylantirilgan.

---

## CT-07 — Parent ↔ installer ↔ backend end-to-end test

**Vazifa:** real productionga yaqin muhitda to‘liq qurilma bog‘lash va ma’lumot oqimini tekshirish.

**Goal:** yangi o‘rnatilgan Windows qurilma parent hisobiga bog‘lanishi va dashboard’da ko‘rinishi.

**Qanday bajarish mumkin:**

1. Yangi test parent hisobi yaratish.
2. Installer orqali enrollment code olish.
3. Parent web yoki mobil ilovada kod/QR orqali qurilmani bog‘lash.
4. Qurilma parent dashboard’da chiqishini tekshirish.
5. Agentdan tracking batch yuborilishini kutish.
6. Activity, alerts va rules oqimlarining asosiy qismini tekshirish.
7. Boshqa parent hisobidan shu qurilmaga kira olmaslikni tenant isolation testi bilan tasdiqlash.

**Checkpoint CT-07:**

- [ ] Signup/login ishlaydi.
- [ ] Enrollment code API’dan olinadi.
- [ ] Parent qurilmani bog‘laydi.
- [ ] Qurilma dashboard’da to‘g‘ri family ostida ko‘rinadi.
- [ ] Tracking ma’lumoti serverga keladi.
- [ ] Parent faqat o‘z qurilmasini ko‘radi.
- [ ] Rules/alerts uchun minimal smoke test o‘tadi.

**Done mezoni:** real foydalanuvchi yo‘li installer’dan dashboard’gacha uzilmasdan ishlaydi.

---

## CT-08 — Security, metadata va signing qarori

**Vazifa:** release’ning Windows trust va xavfsizlik holatini baholash.

**Goal:** installer shaffof, tekshiriladigan va MVP/Beta siyosatiga mos bo‘lishi.

**Qanday bajarish mumkin:**

1. Har bir ichki EXE va final installer metadata/icon’ini ko‘rib chiqish.
2. Installer silent yoki hidden install qilmasligini tasdiqlash.
3. Service display name va executable nomlari brendga mosligini tekshirish.
4. Code signing sertifikati mavjudligini aniqlash.
5. Sertifikat mavjud bo‘lsa agent/bootstrap/final installer’ni bir publisher bilan imzolash va timestamp qo‘yish.
6. Sertifikat mavjud bo‘lmasa unsigned MVP qarorini release notes’da ochiq ko‘rsatish; SmartScreen’ni o‘chirish bo‘yicha ko‘rsatma bermaslik.
7. Imzolangan bo‘lsa `signtool verify /pa` natijasini saqlash.

**Checkpoint CT-08:**

- [ ] Product Name, Company, Description, Version va icon mavjud.
- [ ] Installer yashirin/silent o‘rnatmaydi.
- [ ] Faqat ruxsat etilgan monitoring kategoriyalari consent oynasida ko‘rsatiladi.
- [ ] Code signing holati aniq: `signed` yoki `unsigned MVP`.
- [ ] Signed bo‘lsa signature va timestamp valid.
- [ ] Sertifikat/PFX/parol repo va loglarda yo‘q.

**Done mezoni:** release’ning trust holati hujjatlashtirilgan va xavfsizlik siyosatiga mos.

---

## CT-09 — Antivirus, VirusTotal va integrity gate

**Vazifa:** final RC installer’ni zararli dastur sifatida noto‘g‘ri aniqlanish ehtimoliga tekshirish.

**Goal:** tarqatiladigan fayl yaxlitligi tasdiqlangan va antivirus natijalari qabul qilinadigan darajada bo‘lishi.

**Qanday bajarish mumkin:**

1. Final RC SHA-256 hashini qayta hisoblash va build natijasi bilan solishtirish.
2. Windows Defender bilan local scan qilish.
3. VirusTotal’ga aynan final public artifactni yuborish.
4. Detection chiqsa vendor, detection nomi va sababini tahlil qilish.
5. Ko‘p detection bo‘lsa release’ni bloklash.
6. Aniq false-positive bo‘lsa tegishli vendor/Microsoft portaliga submission qilish.

**Checkpoint CT-09:**

- [ ] SHA-256 builddan keyin o‘zgarmagan.
- [ ] Windows Defender local scan clean.
- [ ] VirusTotal natijasi qayd etilgan.
- [ ] Maqsad: 0–1 detection.
- [ ] Ko‘p detection mavjud bo‘lsa release `BLOCKED` deb belgilangan.
- [ ] False-positive submission kerak bo‘lsa yuborilgan va reference saqlangan.

**Done mezoni:** integrity va antivirus gate PASS yoki release sabab bilan bloklangan.

---

## CT-10 — Download sahifasi va foydalanuvchi hujjatlari

**Vazifa:** rasmiy saytda installer uchun tushunarli va xavfsiz download oqimi tayyorlash.

**Goal:** foydalanuvchi eski console buildni emas, faqat tasdiqlangan professional installer’ni yuklab olishi.

**Qanday bajarish mumkin:**

1. Download sahifasida yagona `ChaqimchiAI Guard Setup.exe` havolasini ko‘rsatish.
2. Publisher, versiya, fayl hajmi, SHA-256 va release sanasini ko‘rsatish.
3. Windows 10/11 uchun qisqa o‘rnatish yo‘riqnomasini yozish.
4. Rozilik, QR/kod va finish oynalari uchun tasdiqlangan screenshotlar qo‘shish.
5. Unsigned MVP bo‘lsa SmartScreen ogohlantirishi haqida halol izoh yozish; himoyani o‘chirishni so‘ramaslik.
6. Privacy Policy, Terms, Support va Contact havolalarini tekshirish.
7. Eski installer URL’larini 404 yoki yangi download sahifasiga xavfsiz redirect qilish.

**Checkpoint CT-10:**

- [ ] Download tugmasi faqat tasdiqlangan final installerga olib boradi.
- [ ] Eski v1/v2/v3 fayllar public yuklab olinmaydi.
- [ ] Versiya va SHA-256 sahifada ko‘rsatilgan.
- [ ] O‘rnatish yo‘riqnomasi real test qilingan GUI’ga mos.
- [ ] Privacy, Terms, Support va Contact sahifalari ochiladi.
- [ ] Download HTTPS orqali ishlaydi.

**Done mezoni:** foydalanuvchi xavfsiz va chalkashliksiz final installer’ni topa oladi.

---

## CT-11 — Release candidate tasdiqlash

**Vazifa:** barcha checkpoint natijalarini bitta release qaroriga yig‘ish.

**Goal:** public release qilish yoki bloklash qarori dalillar asosida qabul qilinishi.

**Qanday bajarish mumkin:**

1. CT-01 dan CT-10 gacha natijalarni ko‘rib chiqish.
2. Kritik va yuqori darajadagi ochiq buglar yo‘qligini tekshirish.
3. Build hash, VirusTotal natijasi, Windows test natijalari va signing holatini release recordga biriktirish.
4. `GO`, `GO WITH KNOWN LIMITATIONS` yoki `NO-GO` qarorini yozish.
5. Known limitations bo‘lsa foydalanuvchiga ko‘rinadigan release notes’ga qo‘shish.

**Checkpoint CT-11:**

- [ ] CT-01–CT-10 kritik checkpointlari PASS.
- [ ] Critical/High ochiq bug yo‘q.
- [ ] Release artifact hash bilan muzlatilgan.
- [ ] Release notes tayyor.
- [ ] Yakuniy `GO/NO-GO` qarori yozilgan.

**Done mezoni:** faqat `GO` qaroridan keyin final artifact public release bosqichiga o‘tadi.

---

## CT-12 — Public release va post-release monitoring

**Vazifa:** tasdiqlangan buildni chiqarish va dastlabki foydalanuvchi muammolarini kuzatish.

**Goal:** foydalanuvchilar faqat tasdiqlangan installer’ni olishi va release muammolari tez aniqlanishi.

**Qanday bajarish mumkin:**

1. Final versiya va changelogni tasdiqlash.
2. Release tag yaratish.
3. Faqat `ChaqimchiAI Guard Setup.exe` va zarur SHA-256 sidecar’ni release asset sifatida joylash.
4. Download sahifasini yangi release’ga yo‘naltirish.
5. Release’dan keyingi dastlabki 24–48 soatda download, install, enrollment va support xatolarini kuzatish.
6. Kritik muammo chiqsa downloadni vaqtincha to‘xtatish va rollback/replace qarorini qabul qilish.

**Checkpoint CT-12:**

- [ ] Release asset nomi to‘g‘ri.
- [ ] Public hash final build bilan mos.
- [ ] Saytdagi download havolasi ishlaydi.
- [ ] Eski assetlar default download sifatida ko‘rinmaydi.
- [ ] 24 soatlik monitoring natijasi qayd etilgan.
- [ ] 48 soatlik monitoring natijasi qayd etilgan.

**Done mezoni:** release barqaror, download va enrollment oqimi ishlaydi, kritik regressiya aniqlanmagan.

---

## Bajarish tartibi

1. `CT-01` — domen va DNS
2. `CT-02` — production API konfiguratsiyasi
3. `CT-03` — Windows release muhiti
4. `CT-04` — versiya qarori
5. `CT-05` — full installer build
6. `CT-06` — Windows GUI/lifecycle test
7. `CT-07` — end-to-end enrollment va tracking
8. `CT-08` — security/signing
9. `CT-09` — Defender/VirusTotal/integrity
10. `CT-10` — download va hujjatlar
11. `CT-11` — GO/NO-GO
12. `CT-12` — public release va monitoring

## Hozirgi eng yaqin milestone

**Milestone M1 — Build Ready**

Quyidagilar bajarilganda M1 tugaydi:

- [ ] CT-01 PASS
- [ ] CT-02 PASS
- [ ] CT-03 PASS
- [ ] CT-04 PASS

M1’dan keyingi aniq ish: Windows release mashinasida `CT-05` bo‘yicha `ChaqimchiAI Guard Setup.exe` release candidate build qilish.
