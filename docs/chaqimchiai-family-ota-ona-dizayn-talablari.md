# ChaqimchiAI Family — Ota-ona Paneli Dizayn Talablari

> Bu hujjat ota-ona foydalanadigan dashboard/mobil interfeys uchun dizayn talablarini belgilaydi. Texnik arxitektura `docs/chaqimchiai-family-arxitektura.md` faylida, bu hujjat esa **UX/UI talablariga** qaratilgan — dizayner yoki frontend AI agent shu asosda ishlaydi.
>
> **Yangilangan yo'nalish:** umumiy brend tizimi, funksional qamrov va
> `parent-ui/`ning prototip sifatidagi roli
> `chaqimchiai-family-loyiha-konsepsiyasi.md`da belgilangan. Ushbu hujjatdagi
> ekran talablari o'sha yagona konsepsiya bilan birga qo'llanadi.

---

## 1. Maqsad va foydalanuvchi profili

**Foydalanuvchi:** ota-ona, ko'pincha texnik bilimi cheklangan, kunda 1-2 marta ilovani ochadigan, tez va tushunarli javob kutadigan odam. U dasturchi emas — grafik, atama va sozlamalar **oddiy tilda** bo'lishi shart.

**Asosiy savollar** ota-ona ilovani ochganda javob topishi kerak bo'lgan narsalar (bular butun IA'ni belgilaydi):

1. Farzandim hozir kompyuterdami, va u yoqilganmi (online/offline)?
2. Bugun qancha vaqt ekran oldida o'tkazdi?
3. Nimalar bilan band edi (qaysi dastur/sayt)?
4. Biror narsa xavotirli bo'ldimi (alert)?
5. Qoidalarni (limit, taqiq) qanday o'zgartirsam bo'ladi?

---

## 2. Dizayn tamoyillari

### 2.1. Ishonch — nazorat emas

Bu ilova **"josuslik dasturi"** emas, **"oilaviy xavfsizlik vositasi"** sifatida his qilinishi kerak. Bu vizual tilga ta'sir qiladi:

* Rang palitrasi **qat'iy/hukmron** (qizil-qora, "surveillance" uslubi) emas, **iliq va tinch** bo'lishi kerak — ko'k-yashil, oq fon, yumshoq soyalar.
* Til ohangi: "Kuzatuv jurnali" emas — **"Bugungi faoliyat"**. "Taqiqlangan" emas — **"Ruxsat etilmagan"**. So'zlar ayblovchi emas, ma'lumot beruvchi bo'lsin.
* Alert'lar hatto salbiy holatda ham **panika emas, xotirjam ohangda**: qizil emas, to'q sariq/amber rang ustuvor bo'lsin qizil o'rniga (qizil faqat haqiqatan jiddiy holat uchun saqlansin).

### 2.2. Soddalik — bitta ekran, bitta savol

Har ekran **bitta aniq savolga** javob bersin (yuqoridagi 5 ta savoldan biriga). Bir ekranda ko'p grafikani, ko'p sonli ma'lumotni birga to'plamaslik — ota-ona 3 soniyada tushunishi kerak.

### 2.3. Mobil-first

Ota-ona ilovani asosan **telefonda**, tez-tez, oraliqda (navbatda turganda, ish tanaffusida) ochadi. Shuning uchun **mobil ilova birlamchi**, web dashboard esa ikkinchi darajali (batafsil ko'rish/sozlash uchun).

### 2.4. Yosh-mos til, bola haqida hurmat bilan

Farzand haqida yozilgan har qanday matn (masalan alert ichida) hurmatli ohangda bo'lishi kerak — "nazorat ostidagi obyekt" emas, farzand sifatida.

---

## 3. Axborot arxitekturasi — asosiy ekranlar

```
┌─────────────────────────────────────┐
│  Onboarding                         │
│  (ro'yxatdan o'tish → qurilma       │
│   qo'shish → shaffoflik tushuntirish)│
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Bosh ekran (Home)                  │
│  - Qurilma holati (online/offline)  │
│  - Bugungi ekran vaqti (katta raqam)│
│  - So'nggi alert (agar bor bo'lsa)  │
└──────┬──────────┬──────────┬────────┘
       ▼          ▼          ▼
 ┌──────────┐┌──────────┐┌──────────┐
 │ Faoliyat ││  Alertlar ││ Qoidalar │
 │ (grafik, ││ (ro'yxat) ││ (limit,  │
 │  app/site││           ││  taqiq)  │
 │  ro'yxati││           ││          │
 └──────────┘└──────────┘└──────────┘
       │
       ▼
 ┌──────────────┐
 │  Sozlamalar   │
 │  (qurilma,    │
 │   hisob,      │
 │   obuna)      │
 └──────────────┘
```

---

## 4. Ekranlar bo'yicha batafsil talablar

### 4.1. Onboarding

* Qadam-baqadam (3-4 qadam), progress indicator bilan.
* Oxirgi qadamda **shaffoflik tushuntirishi** majburiy ko'rsatiladi: nima kuzatilishi, nima kuzatilmasligi (2.1-bo'limdagi ohangda, "Biz nimani ko'ramiz / nimani ko'rmaymiz" formatida — ikki ustunli ro'yxat, yashil tik belgi bilan aniq va ishonchli ko'rinsin).
* Qurilmaga agent o'rnatish qadami: oddiy, bitta tugma bilan yuklab olish + kod orqali oilaga bog'lash (masalan 6 xonali kod, ota-ona telefonda ko'radi, kompyuterda kiritadi).

### 4.2. Bosh ekran (Home)

* Yuqorida **qurilma holati** — katta, aniq belgi: yashil nuqta "Onlayn", kulrang "Oxirgi marta ko'rilgan: 2 soat oldin".
* Markazda **bugungi ekran vaqti** — kunning eng katta, eng ko'zga tashlanadigan raqami (masalan "3s 24d"), tagida kichik progress bar (limitga nisbatan, agar qo'yilgan bo'lsa).
* Pastroqda **so'nggi 24 soat faoliyat qisqacha** — 3-4 ta eng ko'p ishlatilgan ilova, ikonka bilan.
* Agar faol alert bo'lsa — bosh ekranning yuqorisiga **card** sifatida chiqadi (push notification bilan birga keladi), boshqa hamma narsadan oldin ko'rinadi.

### 4.3. Faoliyat (Activity)

* Kun bo'yicha **timeline/bar chart**: soat bo'yicha qaysi vaqtda qancha faol bo'lgani.
* Pastida **ilovalar ro'yxati**, vaqt bo'yicha saralangan (eng ko'p ishlatilgani birinchi), har birida ikonka + nom + vaqt.
* Alohida tab: **saytlar** (domain darajasida) — xuddi shu formatda.
* Kun/hafta/oy filtri — yuqorida oddiy tab yoki segment control.

### 4.4. Alertlar

* Vaqt bo'yicha teskari tartibda ro'yxat (eng yangisi birinchi).
* Har alert: ikonka (turi bo'yicha — soat belgisi limit uchun, ogohlantirish belgisi taqiqlangan dastur uchun), qisqa tavsif, vaqt.
* Bosilganda — batafsil (qaysi dastur, qachon, qancha davom etgan).
* "Barchasini ko'rilgan deb belgilash" imkoniyati.

### 4.5. Qoidalar (Rules)

* Screen-time limit — kunlik soat/daqiqa, oddiy slider yoki raqam kiritish, hafta kunlariga qarab farqli (ixtiyoriy, murakkab bo'lmasin — boshida bitta umumiy limit yetarli).
* Taqiqlangan ilovalar/saytlar ro'yxati — qo'shish tugmasi, mavjud ro'yxatdan tanlash (eng ko'p uchraydigan ilovalar/saytlar oldindan taklif qilinsin, ota-ona nomini yozib qidirmasin).
* Har o'zgarish **darhol saqlanadi** (alohida "Saqlash" tugmasi kerak emas) — ota-ona uchun kamroq qadam.

### 4.6. Sozlamalar

* Qurilmalar ro'yxati (agar bir nechta bo'lsa) — har birini qo'shish/o'chirish.
* Hisob ma'lumotlari, obuna holati (agar premium bo'lsa).
* "Yordam / Bog'lanish" — oddiy foydalanuvchiga texnik yordam kerak bo'lishi muqarrar.

---

## 5. Vizual yo'nalish (umumiy) — Liquid Glass

* **Uslub:** "Liquid Glass" — yarim-shaffof, xira-oynasimon (frosted glass) qatlamlar, yumshoq tomchisimon (droplet) shakllar. Kartochkalar va asosiy elementlar orqa fondagi rangni xira (blurred) holda ko'rsatadi (backdrop blur yoki platforma ekvivalenti), ustida yupqa oq/rangli chegara (border) va yengil yorug'lik qaytarishi (specular highlight, yuqori chetda ochroq gradient chizig'i) bilan.
* **Rang — o'zgarmaydi:** avvalgi palitra (iliq, tinch fon, ko'k yoki yashil-ko'k asosiy aksent, qizil faqat jiddiy alert uchun) shundayligicha saqlanadi. Liquid Glass — bu rang emas, material — shaffoflik/blur/yorug'lik effekti shu ranglarning ustiga qo'shiladi, ularni almashtirmaydi.
* **Shakllar:** katta radiusli, tomchiga o'xshash yumaloq burchaklar (keskin to'g'ri burchaklar emas) — kartochkalar, tugmalar, modal oynalar barchasi shu uslubda.
* **Chuqurlik:** yengil, ko'p qatlamli soya (bir nechta yumshoq soya, "elevation" hissi beruvchi) — lekin og'ir/qattiq soyalar emas, materialning o'zi yengil va suyuq (fluid) his qilinishi kerak.
* **Harakat (ixtiyoriy, agar platforma qo'llasa):** kartochkalar/tugmalar bosilganda yengil "to'lqinlanish" yoki yumshoq scale-animatsiya — suyuqlik metaforasini kuchaytiradi, lekin bezovta qiluvchi darajada emas.
* **Tipografiya:** o'zgarmaydi — katta, o'qish oson shrift o'lchamlari, muhim raqamlar (ekran vaqti) eng katta o'lchamda.
* **Ikonografiya:** oddiy, chiziqli (line-style) ikonkalar, lekin endi yumshoq glass-fon ustiga joylashtiriladi (masalan doira shaklidagi shaffof orqa fon bilan).
* **Grafiklar:** avvalgidek sodda (bar/donut) — grafik chizig'ining o'zi glass-uslubga majburlanmaydi, faqat uni o'rab turgan kartochka shaffof/blur bo'ladi.
* **Ehtiyot chorasi:** shaffoflik/blur ortiqcha bo'lsa, matn o'qilishi qiyinlashadi — har glass qatlam ostida matn kontrasti (WCAG AA darajasida) alohida tekshirilishi kerak, ayniqsa ota-ona auditoriyasi (2.2-bo'lim: tez o'qiladigan, aniq matn talabi) uchun bu chegara buzilmasin.

---

## 6. Bildirishnomalar (Notifications)

* Push notification faqat **muhim** hodisalar uchun (jiddiy alert, qurilma uzoq vaqt offline). Har mayda harakat uchun bildirishnoma yubormaslik — bu ota-onaning ilovani o'chirib qo'yishiga olib keladi.
* Bildirishnoma matni — 2.1-bo'limdagi xotirjam ohangda, hech qachon qo'rqinchli so'zlar bilan emas.

---

## 7. Bosh (empty) va xato holatlar

* Qurilma hali ulanmagan bo'lsa — bosh ekranda qo'rqitmaydigan, yo'naltiruvchi holat: "Hali hech qanday qurilma ulanmagan" + "Qurilma qo'shish" tugmasi.
* Qurilma uzoq vaqt offline bo'lsa (masalan 24 soatdan ko'p) — bu **alert emas**, oddiy holat sifatida ko'rsatiladi ("Oxirgi marta ko'rilgan: 2 kun oldin"), ota-onani notiqsiz qo'rqitmasin (ehtimol batareya tugagan yoki qurilma o'chirilgan, xolos).
* Tarmoq/server xatosi — foydalanuvchiga texnik xato matni (stack trace, kod) hech qachon ko'rsatilmaydi, faqat oddiy til: "Ma'lumotlar yangilanmadi, birozdan keyin qayta urinib ko'ring".

---

## Xulosa

Ota-ona paneli uchun asosiy dizayn printsipi — **soddalik va ishonch**. Har ekran bitta savolga javob beradi, til hukm qiluvchi emas ma'lumot beruvchi, va vizual til "nazorat markazi" emas "oilaviy xotirjamlik" hissini beradi. Bu talablar frontend implementatsiyasi boshlanganda (React/mobile) asos sifatida ishlatiladi.
