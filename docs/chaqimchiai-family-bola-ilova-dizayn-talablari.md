# ChaqimchiAI Family — O'quvchi (Bola) Tomonidagi Ilova Dizayn Talablari

> Bu hujjat bolaning **o'z kompyuterida** ko'rinadigan interfeys uchun talablarni belgilaydi — ya'ni Guard Agent fonda ishlaganda bola bilan qanday "muloqot qiladi". Bu ota-ona paneli (mobil/desktop) hujjatlaridan farqli — bu yerda foydalanuvchi **bola**, va maqsad boshqaruv emas, **shaffof va hurmatli bildirish**.

---

## 1. Nima uchun bolaga umuman interfeys kerak

Ko'p monitoring dasturi bolaga **butunlay ko'rinmas** bo'lishga harakat qiladi — bu noto'g'ri yondashuv, chunki `chaqimchiai-family-arxitektura.md`dagi 3.5-bo'limda belgilangan **shaffoflik tamoyiliga** zid keladi. Agar dastur to'liq yashirin bo'lsa, u "oilaviy xavfsizlik vositasi" emas, "josuslik dasturi" bo'lib qoladi — bu ham axloqiy, ham ko'p mamlakatda huquqiy jihatdan muammoli.

Shuning uchun bola tomonida **doim ko'rinadigan, lekin bezovta qilmaydigan** minimal interfeys bo'ladi: tray icon + kerak bo'lganda bildirishnoma + block screen + o'zi haqidagi ma'lumotni ko'rish imkoniyati.

---

## 2. Dizayn tamoyillari

### 2.1. Yashirin emas, lekin bezovta ham qilmaydigan

Ilova belgisi (tray icon) **doim ko'rinadi** va uni yashirish yoki o'chirish bola tomonidan mumkin emas — bu shaffoflikning texnik kafolati. Lekin u kundalik ishga xalaqit bermaydi: bildirishnomalar kam, faqat kerak bo'lganda chiqadi.

### 2.2. Ayblovchi emas, ma'lumot beruvchi ohang

Hech qachon "Sen buni qila olmaysan!", "Taqiqlangan!" kabi buyruq ohangida emas. Buning o'rniga: "Bugungi ekran vaqting tugadi. Ertaga davom etasan 🙂" kabi tinch, tushunarli til.

### 2.3. Yosh-mos til va vizual uslub

Til va ranglar **bezovta qiluvchi rasmiy/ma'muriy** emas, balki oddiy va do'stona. Murakkab atamalar ("Policy", "Session", "Enforcement") ishlatilmaydi — o'rniga oddiy so'zlar: "qoida", "vaqt", "limit".

### 2.4. Hurmatga asoslangan shaffoflik

Bola istalgan vaqtda **"Ota-onam nimani ko'radi?"** degan savolga javob topa oladigan sahifaga ega bo'lishi kerak — bu ota-ona ilovasidagi shaffoflik tushuntirishining aynan o'zi, faqat bola tiliga moslashtirilgan.

### 2.5. O'zgartirib bo'lmaydigan, lekin ko'rinadigan

Bola qoidalarni (limit, taqiq) **ko'rishi mumkin**, lekin **o'zgartira olmaydi** — bu ota-onaning vakolati. Interfeysda tahrirlash tugmalari umuman bo'lmaydi, faqat ko'rish rejimida.

---

## 3. Interfeys elementlari — to'liq ro'yxat

```
┌───────────────────────────────┐
│  Tray Icon (doim ko'rinadi)    │
└───────────┬───────────────────┘
            │ bosilganda
            ▼
┌───────────────────────────────┐
│  Kichik status oynasi          │
│  - Bugungi ekran vaqti         │
│  - Qolgan vaqt                 │
│  - "Ota-onam nimani ko'radi?"  │
│    havolasi                    │
└───────────────────────────────┘

  Alohida holatlar:
┌───────────────────────────────┐      ┌───────────────────────────────┐
│  Bildirishnoma (toast)         │      │  Block/Lock ekrani             │
│  - Vaqt tugashiga ogohlantirish│      │  - Limit tugaganda yoki        │
│  - Taqiqlangan narsa ochilganda│      │    taqiqlangan narsa ochilganda│
└───────────────────────────────┘      └───────────────────────────────┘
```

---

## 4. Ekranlar/holatlar bo'yicha batafsil talablar

### 4.1. Tray Icon (doimiy)

* Windows taskbar'ning tray qismida doim ko'rinadi — oddiy, do'stona belgi (masalan yumshoq qalqon yoki soat shaklidagi ikonka, qo'rqinchli emas).
* Holat bo'yicha rangi o'zgaradi: yashil (hammasi normal), sariq/amber (vaqt tugashiga oz qoldi), kulrang (limit tugagan/bloklangan).
* Ustiga sichqoncha olib borilsa — qisqa tooltip: "Bugun: 2s 15d ishlatilgan".

### 4.2. Status oynasi (tray icon bosilganda ochiladi)

Kichik, oddiy popup/oyna (to'liq ilova oynasi emas):

* Yuqorida katta raqamda **bugungi ishlatilgan vaqt** va **qolgan vaqt** ("Qoldi: 45 daqiqa").
* Oddiy progress bar (limitgacha qancha qolganini vizual ko'rsatadi).
* Pastda havola: **"Ota-onam nimani ko'radi?"** — bosilsa 4.5-bo'limdagi shaffoflik sahifasi ochiladi.
* Hech qanday sozlama, tahrirlash tugmasi yo'q — faqat ma'lumot ko'rsatiladi.

### 4.3. Bildirishnomalar (toast, Windows notification)

* **Vaqt tugashiga ogohlantirish:** limit tugashidan 15 daqiqa va 5 daqiqa oldin ikkita bosqichli ogohlantirish chiqadi — bola to'satdan uzilib qolmasin, tayyorlanish imkoniga ega bo'lsin. Matn: "15 daqiqadan keyin bugungi ekran vaqting tugaydi."
* **Taqiqlangan dastur/sayt ochilganda:** darhol tinch bildirishnoma — "Bu ilova/sayt ota-onang tomonidan cheklangan" (block screen bilan birga, pastda 4.4).
* Bildirishnomalar soni **minimal** ushlanadi — har mayda harakat uchun emas, faqat 2.2-bo'limdagi muhim holatlar uchun.

### 4.4. Block/Lock ekrani

Taqiqlangan dastur ochilganda yoki screen-time limiti tugaganda ko'rsatiladigan to'liq ekran (yoki o'sha ilova ustiga overlay):

* Katta, tushunarli belgi (masalan soat yoki tinch yuz ifodasi — qo'rqinchli emas).
* Matn: masalan "Bugungi ekran vaqting tugadi. Ertaga davom etasan!" (limit holatida) yoki "Bu ilova hozircha mavjud emas" (taqiq holatida).
* **Hech qanday ayblovchi so'z** ("noto'g'ri", "taqiqlangan harakat qildingiz" kabi) ishlatilmaydi.
* Pastda kichik matn: "Savoling bo'lsa, ota-onangga murojaat qil" — muammoni o'zi bilan hal qilishga emas, oilaviy suhbatga yo'naltiradi.
* **Chiqib ketish/bekor qilish tugmasi yo'q** — bu ekranni faqat qoida o'zi (vaqt o'tishi, ota-ona ruxsat berishi) yopadi. Lekin bu **qo'rqinchli to'liq qulf** emas — kompyuterni o'chirish, boshqa ishlar qilish mumkin, faqat o'sha bitta ilova/vaqt cheklangan.

### 4.5. Shaffoflik sahifasi ("Ota-onam nimani ko'radi?")

Bu — bolaning ishonchini saqlaydigan eng muhim ekran. Ota-ona onboarding'dagi bilan bir xil mazmun, lekin bola tiliga moslashtirilgan:

* Ikki ustunli, oddiy ro'yxat: **"Ota-onam ko'radi"** (qaysi ilovalar ishlatilgani, qaysi saytlarga kirilgani — sayt nomi, sahifalar emas, ekran vaqti) va **"Ota-onam ko'rmaydi"** (yozgan xabarlaring, parollaring, kamera/mikrofon, bosgan tugmalaring).
* Ohang tinch va ishonchli, huquqiy-rasmiy emas — "Bu ilova sening xavfsizliging uchun, va biz nimani ko'rsak ham ochiq aytamiz" kabi jumla bilan boshlanishi mumkin.

---

## 5. Vizual yo'nalish

* Ranglar — ota-ona ilovasidagi palitra bilan **uyg'un** (brend uzluksizligi), lekin biroz yorqinroq/do'stonaroq soyalarda (masalan ko'k-yashil oilasidan, lekin quyuqroq emas ochiqroq tonda).
* Shrift — katta, oddiy, o'qish oson (yosh bola ham o'qiy oladigan darajada).
* Ikonkalar — yumshoq, chiziqli, hech qanday hukm/qulf/qo'riqchi belgisi ishlatilmaydi (bular tahdid hissini beradi) — o'rniga soat, yulduzcha, tinch yuz kabi neytral belgilar.

---

## 6. Til bo'yicha qat'iy qoidalar

Interfeysda hech qachon ishlatilmaydigan so'z/ohanglar: "taqiqlangan", "buzildi", "ruxsatsiz", "jazo", "kuzatilyapsan". Bular o'rniga: "cheklangan", "hozircha mavjud emas", "vaqt tugadi", "ota-onang ko'radi". Maqsad — bola o'zini **ayblangan** emas, **oddiy qoida ichida** his qilsin.

---

## 7. Nima bu ilovaga KIRMAYDI (ataylab)

* Hech qanday **admin panel yoki sozlama** ko'rinishi — bola qoida o'zgartira olmaydi, hatto ko'rish uchun ham murakkab sozlamalar ko'rsatilmaydi.
* Hech qanday **"ilovani o'chirish/to'xtatish"** tugmasi yoki menyu punkti (bu anti-tamper talabiga zid bo'lardi).
* Reklama, ro'yxatdan o'tish so'rovi yoki boshqa "consumer app" elementlari — bu sof funksional, bezovta qilmaydigan interfeys.

---

## 8. Bo'sh va chekka holatlar

* Hali hech qanday qoida (limit) qo'yilmagan bo'lsa — status oynasida "Bugun: 2s 15d ishlatilgan" ko'rsatiladi, lekin progress bar/limit ko'rsatilmaydi (chunki limit yo'q).
* Tarmoq uzilganda (server bilan aloqa yo'q) — bola tomonida hech qanday xato ko'rsatilmaydi, chunki bu (arxitektura hujjatidagi 5-bo'lim) buffer+sync orqali fonda hal bo'ladi — bola buni sezmasligi kerak.
* Agent yangilanayotganda (OTA) — qisqa, tinch bildirishnoma: "Ilova yangilanmoqda, bir necha soniya" — hech qanday uzoq kutish yoki qayta ishga tushirish talab qilinmasin.

---

## Xulosa

Bola tomonidagi interfeys — boshqaruv paneli emas, **shaffof va hurmatli bildirish qatlami**. Uning yagona vazifasi: bola doim biladiki, monitoring bor, nima kuzatilyapti, va qoidalar nima — lekin hech qachon ayblangan yoki nazorat ostida his qilmaydi. Tray icon, status oynasi, bildirishnomalar, block ekran va shaffoflik sahifasi — beshta element to'liq shu tamoyilga xizmat qiladi.
