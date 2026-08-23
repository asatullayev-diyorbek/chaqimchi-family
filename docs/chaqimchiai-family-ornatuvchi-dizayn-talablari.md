# ChaqimchiAI Family — O'rnatuvchi (Installer) va Lokal Sozlamalar Dizayn Talablari

> Bu hujjat Guard Agent'ni bolaning kompyuteriga **o'rnatish jarayoni** (installer wizard) va o'rnatilgandan keyin qurilmada qoladigan **lokal sozlamalar paneli** uchun talablarni belgilaydi. Bu — to'rtinchi va oxirgi interfeys qatlami: mobil panel, desktop panel, bola tomoni va endi shu — o'rnatuvchi.
>
> Installerning yangilangan sahifa dizaynlari `child-ui/welcome.html`dan
> `child-ui/complete.html`gacha joylashgan. Ular
> `chaqimchiai-family-loyiha-konsepsiyasi.md`dagi umumiy loyiha tizimiga mos
> holda implementatsiya qilinadi.

---

## 1. Kim va qachon ishlatadi

O'rnatuvchini ishlatuvchi — **ota-ona yoki katta yoshdagi oila a'zosi**, bola emas. Bu jarayon odatda bola yonida yoki uning ruxsati bilan amalga oshiriladi (shaffoflik tamoyiliga mos — 3.5-bo'lim, arxitektura hujjati). Shuning uchun bu interfeysning ohangi **ota-ona paneliga yaqin** (professional, ishonchli), bola tomoni ilovasidagi kabi "yumshoq/o'yinli" emas.

O'rnatuvchi ikkita muhim vazifani bajaradi: **(1)** dasturni Windows'da SYSTEM service sifatida o'rnatish, **(2)** qurilmani oiladagi hisobga bog'lash — qurilma QR/raqamli kod ko'rsatadi, ota-ona mobil ilova orqali skaner qiladi.

---

## 2. Dizayn tamoyillari

### 2.1. Bu — shaffoflik uchun eng muhim lahza

O'rnatish payti — ota-ona (va ehtimol bola ham yonida) birinchi marta **nima kuzatilishi va nima kuzatilmasligini** to'liq ko'radigan payt. Shuning uchun shaffoflik matni (2.4-bo'lim, bola hujjatidagi 4.5 bilan bir xil mazmun) **o'tkazib yuborib bo'lmaydigan qadam** sifatida joylashtiriladi — "Keyinroq o'qiyman" tugmasi yo'q.

### 2.2. Qisqa va tezkor

O'rnatuvchi ko'p qadamli bo'lmasin — 5 daqiqadan ortiq davom etmasligi kerak. Har qadam bitta aniq harakat talab qiladi.

### 2.3. Windows odatiy paterniga mos

Foydalanuvchi Windows'da ko'nikkan installer uslubiga (progress bar, Next/Back tugmalari, UAC so'rovi) mos keladi — o'ziga xos g'ayrioddiy UI o'ylab topilmaydi, chunki bu ishonchni kamaytiradi ("bu dastur normal dasturga o'xshamayapti" degan hisni oldini olish uchun).

### 2.4. Ortga qaytarib bo'lmaydigan harakatlar oldindan aniq aytiladi

"O'rnatish" tugmasi bosilgandan keyin nima sodir bo'lishi (SYSTEM service sifatida ishga tushishi, kompyuterni qayta ishga tushirish kerakligi agar bo'lsa) oldindan aniq yozilgan bo'lishi kerak.

---

## 3. O'rnatuvchi oynalari — to'liq ketma-ketlik

```
1. Xush kelibsiz
        ↓
2. Shaffoflik va rozilik (majburiy o'qiladi)
        ↓
3. Windows UAC so'rovi (tizim darajasida, standart Windows oynasi)
        ↓
4. Oilaga bog'lash (QR kod / raqamli kod ko'rsatiladi, ota-ona telefon bilan skaner qiladi)
        ↓
5. O'rnatish jarayoni (progress bar)
        ↓
6. Tayyor / Yakunlandi
```

### 3.1. Oyna 1 — Xush kelibsiz

* Logotip, qisqa sarlavha: "ChaqimchiAI Family'ga xush kelibsiz".
* Bir jumlali tavsif: "Bu dastur farzandingizning kompyuterdan foydalanishini xavfsiz va shaffof tarzda kuzatishga yordam beradi."
* Bitta tugma: **"Davom etish"**.

### 3.2. Oyna 2 — Shaffoflik va rozilik (eng muhim oyna)

* Sarlavha: **"Nimani ko'ramiz, nimani ko'rmaymiz"**.
* Ikki ustunli jadval — mobil/bola hujjatlaridagi bilan **so'zma-so'z bir xil** mazmun (ilova/sayt nomi, ekran vaqti — HA; xabarlar, parollar, kamera/mikrofon, bosilgan tugmalar — YO'Q).
* Pastda katta harf bilan emas, oddiy matnda: kichik checkbox — **"O'qidim va roziman"** — bu belgilanmaguncha "Davom etish" tugmasi faol emas (disabled holatda, kulrang).
* **"Orqaga"** tugmasi mavjud, lekin bu oynani "o'tkazib yuborish" imkoni yo'q.

### 3.3. Windows UAC so'rovi

Bu — o'rnatuvchining o'zi chizmaydigan, Windows tizimining standart administrator ruxsati oynasi. Alohida dizayn talab qilinmaydi, faqat: o'rnatuvchi oldidan foydalanuvchiga **nima uchun bu so'ralishini** tushuntiruvchi bitta jumla ko'rsatilishi kerak (masalan shu oynaning o'zida yoki undan oldin): "Endi Windows sizdan ruxsat so'raydi — bu dasturning to'g'ri ishlashi uchun zarur."

### 3.4. Oyna 3 — Oilaga bog'lash

Bu bosqichda yo'nalish **teskari**: kod ota-ona ilovasidan emas, **shu qurilmaning o'zidan** chiqadi, va ota-ona uni telefoni bilan o'qiydi. Sabab — bu ota-ona uchun terishdan ko'ra tezroq va xatosizroq.

* Sarlavha: "Qurilmani hisobingizga bog'lang".
* Ekranda katta **QR kod** ko'rsatiladi — o'rtasida.
* QR koddan pastda, kichikroq: **6 xonali raqamli kod** ham ko'rsatiladi (masalan `482 913`) — agar telefonda kamera ishlamasa yoki ota-ona QR skaner qilishni istamasa, shu raqamni mobil ilovaga qo'lda kiritish mumkin.
* Tushuntirish matni: "Mobil ilovani oching → 'Qurilma qo'shish' → QR kodni skaner qiling yoki raqamni kiriting."
* Kod **vaqtincha** (masalan 5-10 daqiqa amal qiladi) — muddati tugasa, "Yangi kod olish" tugmasi bilan yangilanadi (xavfsizlik uchun: kod uzoq muddat amal qilsa, uni kimdir boshqa vaqtda suratga olib ishlatib qolishi mumkin).
* Ota-ona telefonda skanerlaganidan keyin, installer avtomatik ravishda bog'langanini aniqlaydi (server orqali polling yoki WebSocket) va darhol keyingi oynaga o'tadi, tasdiqlovchi belgi (✓) bilan — bu oynada foydalanuvchi hech qanday tugma bosmaydi, jarayon o'zi davom etadi.
* Agar kod muddati tugasa va ota-ona hali skaner qilmagan bo'lsa — tinch xabar: "Kod muddati tugadi" + "Yangi kod olish" tugmasi.

### 3.5. Oyna 4 — O'rnatish jarayoni

* Oddiy progress bar + qisqa status matn ("Fayllar nusxalanmoqda...", "Xizmat sozlanmoqda...").
* Bu jarayon davomida "Bekor qilish" tugmasi mavjud bo'lishi mumkin (foydalanuvchi fikridan qaytsa), lekin progress 80%dan oshgandan keyin bekor qilish tavsiya etilmaydi (yarim o'rnatilgan holatda qoldirmaslik uchun).

### 3.6. Oyna 5 — Yakunlandi

* Katta tasdiqlovchi belgi (✓) + "Tayyor! ChaqimchiAI Family endi ishlamoqda."
* Qisqa eslatma: "Bu oynani yopishingiz mumkin — dastur fonda ishlashda davom etadi."
* Ixtiyoriy tugma: "Mobil ilovada ko'rish" (agar telefon shu kompyuterda ochilsa, havola yoki QR).

---

## 4. Lokal sozlamalar paneli (o'rnatilgandan keyin)

Bu — kompyuterda agent o'rnatilgandan keyin **parolla himoyalangan** kichik panel (bola kirmasligi uchun). Bunga kirish yo'li: tray icon'da (bola tomoni hujjatidagi) "Kattalar uchun" degan kichik, ko'zga unchalik tashlanmaydigan havola — bosilsa parol so'raladi (oila hisobi paroli yoki alohida PIN).

### 4.1. Qurilma holati (Status)

* Server bilan aloqa holati (ulangan/uzilgan), oxirgi sinxronizatsiya vaqti, agent versiyasi.
* "Diagnostika ma'lumotini yuborish" tugmasi (agar texnik yordam kerak bo'lsa).

### 4.2. Qayta bog'lash (Re-link)

* Agar qurilma boshqa oila hisobiga o'tkazilishi kerak bo'lsa (masalan kompyuter sotilsa yoki oila ichida qayta taqsimlansa) — yangi kod bilan qayta bog'lash imkoniyati.

### 4.3. O'chirish (Uninstall) — ochiq va standart Windows oqimi

* Dastur Windows "Installed apps / Apps & features" ro'yxatida aniq publisher va nom bilan ko'rinadi; standart uninstall ishlaydi.
* Lokal paneldagi "O'chirish" tugmasi ham xuddi shu ko'rinadigan uninstall oqimini ochadi. Tasdiqlash dialogi service, autostart va lokal monitoring ma'lumotlari olib tashlanishini aniq aytadi.
* O'chirish tugagach, bog'langan oila hisobiga ota-onani xabardor qilish mumkin, ammo o'chirishni yashirin bloklash yoki Windows'ning normal uninstall imkoniyatini cheklash mumkin emas.
* Batafsil majburiy siyosat: [Windows Security & Trust](windows-security-trust-guideline.md).

### 4.4. Yordam

* Qo'llab-quvvatlash sahifasiga havola, ko'p so'raladigan savollar.

---

## 5. Vizual yo'nalish

* O'rnatuvchi — ota-ona/desktop paneldagi rang-ohangda (professional, xotirjam, ko'k-yashil oilasi), bola tomoni ilovasidagidek "yumshoq/o'yinli" emas, chunki bu operatorni (ota-ona) nishonga oladi.
* Windows odatiy installer o'lchamlari va shriftlariga yaqin (400–500px kenglikdagi oyna, standart tugma joylashuvi: pastda o'ngda "Davom etish", chapda "Orqaga").

---

## 6. Chekka holatlar

* **Qurilma allaqachon boshqa oilaga bog'langan bo'lsa** — o'rnatuvchi buni aniqlaydi va tinch xabar beradi: "Bu qurilma allaqachon boshqa hisobga bog'langan. Davom etish uchun avval uni ajratish kerak" + qo'llab-quvvatlashga havola.
* **Tarmoq yo'q bo'lganda o'rnatish** — kod tasdiqlash bosqichi internetga muhtoj, shuning uchun agar tarmoq yo'q bo'lsa, tinch xabar: "Internet aloqasi kerak. Tarmoqqa ulanib qaytadan urinib ko'ring" — o'rnatishni davom ettirishga ruxsat berilmaydi (chunki bog'lash kodi serverda tekshiriladi).
* **UAC rad etilsa** (foydalanuvchi "Yo'q" bossa) — o'rnatuvchi tushuntiradi: "O'rnatish uchun administrator ruxsati zarur" va qaytadan urinish imkonini beradi, dasturdan majburan chiqarib yubormaydi.

---

## Xulosa

O'rnatuvchi — ota-ona operator bo'lgan, professional ohangdagi, lekin shaffoflik uchun **majburiy to'xtash nuqtasi** (Oyna 2) bilan qurilgan oqim. O'rnatilgandan keyingi lokal sozlamalar paneli esa ataylab **cheklangan va parolla himoyalangan** — bola kira olmaydi, o'chirish esa faqat oila hisobi tasdiqi va ota-onaga xabar berish orqali amalga oshadi, bu anti-tamper va shaffoflik talablarini birga qondiradi.
