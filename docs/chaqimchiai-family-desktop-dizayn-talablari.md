# ChaqimchiAI Family — Desktop (Web) Panel Dizayn Talablari

> Bu hujjat ota-ona uchun **desktop/web dashboard**ning to'liq ekran talablarini belgilaydi. Mobil ilova talablari `chaqimchiai-family-ota-ona-dizayn-talablari.md` faylida — bu ikkisi bir xil dizayn tamoyillariga (ishonch, soddalik, xotirjam ohang) asoslanadi, lekin **desktop chuqurroq tahlil uchun, mobil tezkor tekshirish uchun** ishlatiladi.

---

## 1. Desktop vs Mobil — rol farqi

Mobil ilova ota-onaning **kunda bir necha marta tezkor qaraydigan** vositasi. Desktop esa boshqacha stsenariy uchun: ota-ona **haftalik/oylik ko'rib chiqish**, qoidalarni batafsil sozlash, bir nechta qurilma/farzandni solishtirish, yoki chuqurroq tahlil qilish uchun o'tiradi. Shuning uchun:

* Desktopda **ma'lumot zichligi yuqoriroq** bo'lishi mumkin (bir ekranda ko'proq grafik, jadval) — lekin bu "murakkab admin panel"ga aylanib ketmasligi kerak, mobildagi xotirjam ohang saqlanadi.
* Desktop — **ko'p qurilma/farzandli oilalar** uchun asosiy boshqaruv joyi (mobilda bu qiyinroq sig'adi).
* Navigatsiya mobildagi pastki tab emas, **chap tomondagi doimiy sidebar** orqali amalga oshiriladi — bu desktop foydalanuvchisi uchun kutiladigan patern.

---

## 2. Dizayn tamoyillari (mobil bilan umumiy, desktopga moslashtirilgan)

Barcha mobil hujjatdagi tamoyillar (2.1–2.4-bo'lim: ishonch/nazorat emas, sodda til, hurmatli ohang) **o'zgarmasdan** qo'llaniladi. Qo'shimcha desktop-specific qoidalar:

* **Ma'lumot zichligi — nazoratli.** Ko'proq narsa ko'rsatish mumkin bo'lsa ham, har ekranda 1-2 ta asosiy fokus saqlanadi, qolgani ikkinchi darajali joylashuvga (yon panel, kengaytiriladigan bo'lim) qo'yiladi.
* **Klaviatura va sichqoncha uchun qulaylik** — jadvallarda saralash, filtrlash; muhim harakatlar (qoida qo'shish, alert ko'rish) 2 klikdan oshmasin.
* **Keng ekranda bo'shliq behuda sarflanmaydi**, lekin "hammasini to'ldirish" ham kerak emas — oq joy tinchlik hissini beradi (mobil ohangga mos).

---

## 3. Umumiy layout tuzilishi

```
┌───────────────────────────────────────────────────────────┐
│  Logotip          Qurilma tanlovi (agar bir nechta)   Profil│
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│ SIDEBAR  │               ASOSIY KONTENT MAYDONI             │
│          │                                                  │
│ Bosh sahifa │                                               │
│ Faoliyat    │                                               │
│ Alertlar    │                                               │
│ Qoidalar    │                                               │
│ Qurilmalar  │                                               │
│ Sozlamalar  │                                               │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

* **Yuqori panel (header):** logotip, agar oilada bir nechta farzand/qurilma bo'lsa — yuqorida oddiy **dropdown** orqali farzand tanlash (butun panel shu tanlovga qarab yangilanadi), o'ng tomonda profil/chiqish.
* **Chap sidebar:** doimiy ko'rinadigan navigatsiya, 6 ta asosiy bo'lim (pastda batafsil).
* **Asosiy kontent maydoni:** tanlangan bo'lim kontenti.

---

## 4. Ekranlar — to'liq ro'yxat va talablar

### 4.1. Login / Ro'yxatdan o'tish

* Sodda, markazlashgan forma (email + parol), "Parolni unutdingizmi" havolasi.
* Ro'yxatdan o'tish — mobil onboarding bilan bir xil oqim, lekin desktopda bitta uzun sahifada (qadam-baqadam emas, chunki desktopda bo'sh joy ko'proq): hisob yaratish → shaffoflik tushuntirishi → birinchi qurilma qo'shish (kod orqali bog'lash).
* Shaffoflik tushuntirishi shu yerda ham **majburiy ko'rsatiladi** — "Biz nimani ko'ramiz / ko'rmaymiz" ikki ustunli jadval, mobil versiyasi bilan bir xil matn.

### 4.2. Bosh sahifa (Overview) — bir nechta qurilma/farzandli umumiy ko'rinish

Bu ekran **mobil bosh ekrandan farqli** — u yerda bitta qurilma ko'rsatiladi, bu yerda **hammasi birga**, kartochkalar (card) shaklida:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Ali         │  │  Vali        │  │  + Qurilma  │
│  🟢 Onlayn   │  │  ⚪ Offline   │  │   qo'shish  │
│  2s 15d      │  │  4s 02d      │  │             │
│  bugungi     │  │  (kecha)     │  │             │
└─────────────┘  └─────────────┘  └─────────────┘
```

Har kartochka bosilganda o'sha farzandning batafsil ko'rinishiga o'tadi (4.3–4.6 bo'limlar). Kartochkada: ism, holat (online/offline + rang belgisi), bugungi ekran vaqti, agar faol alert bo'lsa — kichik ogohlantirish belgisi.

Bu ekranning pastida — **umumiy oilaviy statistika** (ixtiyoriy kengaytiriladigan bo'lim): barcha farzandlar bo'yicha haftalik solishtirma grafik (bar chart, har farzand alohida rang).

### 4.3. Faoliyat (Activity) — tanlangan farzand uchun

Bu — desktopning eng **chuqur tahlil** ekrani, mobildagidan ancha kengroq:

* Yuqorida **davr tanlovi**: Bugun / Hafta / Oy / Maxsus oraliq (sana tanlash bilan).
* Asosiy grafik: **soat/kun bo'yicha ekran vaqti** (bar yoki area chart), kategoriya bo'yicha rangli (ta'lim/o'yin/ijtimoiy tarmoq/boshqa — agar app-categorization mavjud bo'lsa).
* Yon tomonda yoki pastda: **ilovalar jadvali** — ustun sarlavhalari bo'yicha saralanadigan (Nom, Kategoriya, Sarflangan vaqt, Oxirgi ishlatilgan). Jadval, chunki desktopda bu tabiiy patern.
* Alohida tab: **Saytlar** — xuddi shunday jadval, domen darajasida (2-bo'limda aytilganidek, to'liq URL emas).
* Eksport imkoniyati (ixtiyoriy, keyingi bosqichda): "Hisobotni yuklab olish" (PDF/CSV) — desktop foydalanuvchisi ko'proq kutadigan feature.

### 4.4. Alertlar

* To'liq **jadval/ro'yxat ko'rinishda**, filtrlash imkoniyati bilan (turi bo'yicha, sana bo'yicha, ko'rilgan/ko'rilmagan).
* Har qatorda: ikonka (turi), qisqa tavsif, qaysi farzand/qurilma, vaqt, holat (yangi/ko'rilgan).
* Qatorga bosilganda — o'ng tomonda yoki modal oynada batafsil (mobildagi bilan bir xil kontent).
* Yuqorida: "Barchasini ko'rilgan deb belgilash" va filtr tugmalari.

### 4.5. Qoidalar (Rules) — desktopdagi eng batafsil sozlash joyi

Bu ekran desktopda **mobildan ancha kengroq** bo'lishi tabiiy, chunki qoida sozlash ko'p input talab qiladi:

* **Screen-time limit** — farzand bo'yicha, hafta kunlariga qarab alohida (Dushanba–Juma / Shanba–Yakshanba uchun alohida qiymat) — jadval ko'rinishda, har kun uchun input.
* **Taqiqlangan ilovalar/saytlar** — qidiruv bilan qo'shish, mavjud ro'yxat pastda chip/tag ko'rinishda, har birining yonida o'chirish (×) belgisi.
* **Vaqt oynalari (ixtiyoriy, keyingi versiya):** masalan "22:00–07:00 orasida qurilma bloklansin" — vizual timeline slider bilan.
* Har o'zgarish **avtomatik saqlanadi** (mobil bilan bir xil qoida — "Saqlash" tugmasi shart emas), lekin desktopda pastda kichik "Saqlandi ✓" indikatori ko'rsatilishi mumkin (foydalanuvchiga tasdiq berish uchun, chunki desktopda forma ancha uzun bo'lgani sabab tasdiq muhimroq).

### 4.6. Qurilmalar (Devices)

* Barcha bog'langan qurilmalarning jadvali: nomi, farzand, holat, oxirgi sinxronizatsiya vaqti, agent versiyasi.
* Har qurilma uchun harakatlar: qayta nomlash, o'chirish (unlink), "qayta ulash kodi" olish.
* "Yangi qurilma qo'shish" tugmasi — bosilganda 6 xonali kod ko'rsatiladi (mobil onboarding bilan bir xil oqim).

### 4.7. Sozlamalar (Settings)

* **Hisob:** email, parolni o'zgartirish, ikki bosqichli autentifikatsiya (agar bo'lsa).
* **Oila a'zolari:** agar ikkala ota-ona ham kirishni xohlasa — qo'shimcha ota-ona hisobini taklif qilish (ixtiyoriy, keyingi versiya).
* **Obuna/Billing:** joriy reja (free/premium), to'lov tarixi, bekor qilish.
* **Bildirishnomalar:** qaysi turdagi alert uchun email/push kelishini yoqish/o'chirish.
* **Yordam:** ko'p so'raladigan savollar, bog'lanish.

---

## 5. Komponent talablari (umumiy) — Liquid Glass

* **Material — Liquid Glass:** mobil hujjatdagi (`chaqimchiai-family-ota-ona-dizayn-talablari.md`, 5-bo'lim) endi yangilangan Liquid Glass yo'nalishi bu yerda ham **aynan shu** — yarim-shaffof, xira-oynasimon (frosted glass) kartochkalar, tomchisimon yumaloq shakllar, yengil yorug'lik qaytarishi. Rang palitrasi o'zgarmaydi (iliq, tinch, ko'k/yashil-ko'k asosiy).
* **Kartochkalar (cards):** endi yumshoq soya + blur/shaffoflik + katta radius birgalikda — desktopda ko'proq kartochka bir ekranda ko'rinishi mumkinligi sabab (Overview'dagi bir nechta kartochka), orqadagi kontent xira ko'rinib, chuqurlik hissini kuchaytiradi.
* **Sidebar:** doimiy sidebar ham glass-material sifatida (xira fon ustida, asosiy kontentdan farqlanadigan yengil shaffoflik) — bu desktop-specific joylashuv, mobilda mos keladigan elementi yo'q.
* **Jadvallar:** jadval o'zi (qatorlar, matn) glass-effektga majburlanmaydi — o'qilishni qiyinlashtiradi (ma'lumot zichligi yuqori joy). Faqat jadvalni o'rab turgan kartochka/panel shaffof bo'ladi, jadval ichidagi fon esa o'qish uchun yetarlicha qattiq (opaque yoki yuqori-opasity) qoladi.
* **Grafiklar:** oddiy, ortiqcha texnik bo'lmagan (bar/area/donut) — murakkab dashboard-uslub grafik (masalan ko'p o'qli, zichlashgan) ishlatilmaydi, chunki bu ota-ona uchun mo'ljallangan, tahlilchi uchun emas.
* **Ehtiyot chorasi:** desktopda ma'lumot zichligi yuqoriroq bo'lgani sabab (2-bo'lim), blur/shaffoflik effekti matn kontrastini kamaytirmasligi mobildagidan ham qattiqroq tekshirilishi kerak — ayniqsa jadval va uzun matnlarda.

---

## 6. Responsive va ekran o'lchamlari

* Asosiy dizayn **1280px** kenglikka mo'ljallanadi (odatiy noutbuk ekrani).
* **1024px'dan kichik** ekranlarda sidebar collapse (faqat ikonkalar) rejimiga o'tishi kerak.
* **768px'dan kichik** (planshet) — bu holatda aslida mobil ilova/responsive web-app patern qo'llanilishi tavsiya etiladi, desktop layout emas.

---

## 7. Bosh (empty) va xato holatlar

* Hali qurilma qo'shilmagan bo'lsa — Overview ekranida faqat "+ Qurilma qo'shish" kartochkasi ko'rinadi, boshqa hech narsa (bo'sh grafik yoki "ma'lumot yo'q" xabarlari bilan to'ldirilmaydi).
* Alertlar bo'sh bo'lsa — "Hozircha hech qanday ogohlantirish yo'q" + tinch ikonka (masalan tik belgisi), bo'sh jadval emas.
* Server/tarmoq xatosi — mobildagi kabi, texnik xato matni hech qachon ko'rsatilmaydi, faqat "Ma'lumotlar yangilanmadi, birozdan keyin qayta urinib ko'ring" + qayta yuklash tugmasi.

---

## Xulosa

Desktop panel — ota-onaning **chuqur tahlil va boshqaruv** markazi, mobil esa **tezkor tekshirish** vositasi. Ikkalasi bir xil dizayn tili (rang, ohang, til) bilan bog'langan, lekin desktop ko'proq ma'lumot zichligi, jadvallar va ko'p-qurilma boshqaruvini qo'llab-quvvatlaydi. Sidebar navigatsiyasi va 7 ta asosiy ekran (Login, Overview, Faoliyat, Alertlar, Qoidalar, Qurilmalar, Sozlamalar) — frontend implementatsiyasi uchun to'liq asos.
