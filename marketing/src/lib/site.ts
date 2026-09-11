// One place for every outbound URL and headline constant the landing page
// uses, so copy changes don't mean hunting through components.

export const SITE = {
  name: "Spino24",
  domain: "https://chaqimchi-ai.uz",
  tagline: "Oila uchun ochiq ekran-vaqt qoidalari — yashirin kuzatuv emas.",
  appUrl: "https://guard.chaqimchi-ai.uz",
  loginUrl: "https://guard.chaqimchi-ai.uz/login",
  signupUrl: "https://guard.chaqimchi-ai.uz/signup",
  downloadUrl: "https://guard.chaqimchi-ai.uz/download",
  botUrl: "https://t.me/ChaqimchiGuardBot",
  supportEmail: "salom@chaqimchi-ai.uz",
  privacyUrl: "/maxfiylik",
  termsUrl: "/foydalanish-shartlari",
} as const;

export const NAV_LINKS = [
  { href: "#imkoniyatlar", label: "Imkoniyatlar" },
  { href: "#qanday", label: "Qanday ishlaydi" },
  { href: "#bola", label: "Bola nima ko'radi" },
  { href: "#narx", label: "Narx" },
  { href: "#faq", label: "FAQ" },
];

// Demo app list for the previews. Parent-facing UI shows human names, never
// process names — matches how the real dashboard renders them.
export const DEMO_APPS = [
  { name: "Google Chrome", minutes: 58, icon: "logos:chrome", color: undefined },
  { name: "Minecraft", minutes: 44, icon: "simple-icons:minecraft", color: "#68b247" },
  { name: "YouTube", minutes: 31, icon: "logos:youtube-icon", color: undefined },
  { name: "Steam", minutes: 26, icon: "logos:steam", color: undefined },
];

// 7-day sample, mins per day (Mon→Sun). Kept internally consistent with the
// "o'rtacha" figures shown elsewhere.
export const DEMO_WEEK = [
  { d: "Du", m: 160 },
  { d: "Se", m: 200 },
  { d: "Ch", m: 185 },
  { d: "Pa", m: 250 },
  { d: "Ju", m: 210 },
  { d: "Sh", m: 285 },
  { d: "Ya", m: 245 },
];

export const DEMO_CATEGORIES = [
  { label: "Ta'lim", pct: 34, color: "var(--cat-teal)" },
  { label: "O'yin", pct: 28, color: "var(--cat-blue)" },
  { label: "Ijtimoiy", pct: 22, color: "var(--cat-amber)" },
  { label: "Boshqa", pct: 16, color: "var(--cat-slate)" },
];

export const PROMISES = [
  {
    icon: "solar:eye-linear",
    title: "Shaffoflik",
    points: [
      "Bola agent borligini biladi",
      "Nima kuzatilishi ochiq ko'rsatiladi",
      "Yashirin monitoring yo'q",
    ],
  },
  {
    icon: "solar:slider-vertical-linear",
    title: "Xotirjam boshqaruv",
    points: [
      "Ota-ona limit va qoidalarni belgilaydi",
      "Bir necha bola va qurilmani boshqaradi",
      "Jazo emas — kelishuv",
    ],
  },
  {
    icon: "solar:wi-fi-router-minimalistic-linear",
    title: "Offline barqarorlik",
    points: [
      "Internet bo'lmasa ham qoidalar ishlaydi",
      "Ulanish qaytganda ma'lumot sinxronlanadi",
    ],
  },
];

// First three — large alternating blocks with a small live-looking preview.
export const FEATURE_BLOCKS = [
  {
    tag: "Ekran vaqti",
    title: "Kunlik ekran vaqti limiti",
    body:
      "Kuniga necha daqiqa. Ish kunlari va dam olish kunlari (Sh–Ya) uchun alohida qiymat qo'yiladi. Limit tugashiga 15 va 5 daqiqa qolganda bola ogohlantiriladi.",
    preview: "limit",
  },
  {
    tag: "Tinch soatlar",
    title: "Dam olish vaqti oynalari",
    body:
      "Masalan 22:00–07:00 — bu oraliqda ekran xushmuomala tarzda bloklanadi va ertaga o'zi ochiladi. Bir nechta oyna qo'yish mumkin.",
    preview: "quiet",
  },
  {
    tag: "Ilovalar",
    title: "Ayrim ilovalarni cheklash",
    body:
      "Ilovani nomi bo'yicha cheklang. Bola ilovasi buni «hozircha mavjud emas» holati sifatida ko'rsatadi, ochilganda esa ota-onaga xabar boradi.",
    preview: "app",
  },
];

// The rest — compact cards.
export const FEATURE_CARDS = [
  {
    tag: "Faoliyat",
    title: "Faoliyat tarixi",
    body:
      "Qaysi ilova qancha ishlatilgani — ikonkasi bilan. Kun / hafta / oy kesimida, CSV eksport bilan.",
    icon: "solar:chart-2-linear",
  },
  {
    tag: "Ogohlantirish",
    title: "Muhim xabarlar",
    body:
      "Limit tugadi, cheklangan ilova ochildi, qurilmada «Kattalar uchun» paneli ochildi — darhol bildiriladi.",
    icon: "solar:bell-linear",
  },
  {
    tag: "Telegram",
    title: "Telegram bot — to'liq mini-panel",
    body:
      "@ChaqimchiGuardBot'da /menyu: Qurilmalar, Farzandlar, Bugungi statistika, Ogohlantirishlar — tugmalar bilan, panelni ochmasdan. Har oqshom qisqa hisobot ham shu yerga keladi.",
    icon: "solar:plain-2-linear",
  },
  {
    tag: "Ekran rasmi",
    title: "So'rov bo'yicha ekran rasmi",
    body:
      "Bir marta bosib, ayni damdagi ekran rasmini ko'ring. Avtomatik emas — faqat siz so'raganda, va bola har safar buni bildirishnoma orqali ko'radi. 1 kun / 1 hafta / 1 oy saqlanadi, keyin o'zi o'chadi.",
    icon: "solar:camera-linear",
  },
];

export const STEPS = [
  {
    n: "01",
    title: "O'rnatib bog'laysiz",
    body:
      "Windows dasturini yuklab oling. Rozilik oynasidan so'ng ekrandagi QR kodni mobil ilova bilan skanerlang yoki 6 xonali kodni kiriting.",
  },
  {
    n: "02",
    title: "Qoidalarni belgilaysiz",
    body:
      "Web panelda kunlik limit, dam olish vaqti va cheklangan ilovalarni sozlaysiz. O'zgarishlar qurilmaga o'zi yetadi.",
  },
  {
    n: "03",
    title: "Xotirjam kuzatasiz",
    body:
      "Kundalik holat, faoliyat va xabarlar bir joyda. Bola ham o'z ekranida qoidalar va qolgan vaqtni ko'rib turadi.",
  },
];

export const PRIVACY_POINTS = [
  "Bola tray belgisi va status oynasi orqali agent borligini ko'radi",
  "Bloklash oynasi tushunarli va xushmuomala",
  "Ma'lumot faqat sizning oila hisobingizga bog'lanadi va sotilmaydi",
];

export const DATA_COLLECTED = [
  "Faoliyat vaqti",
  "Ilova nomi",
  "Tashrif buyurilgan sayt domeni",
  "Qurilma holati",
  "Ekran rasmi — faqat siz so'raganda, bola bildirishnoma orqali ko'radi",
];

export const DATA_NOT_COLLECTED = [
  "Doimiy ekran yozuvi yoki avtomatik skrinshot",
  "Klaviatura yozuvi",
  "Mikrofon",
  "To'liq havolalar va sahifa mazmuni",
  "Shaxsiy xabarlar",
];

// Narxlar server/apps/accounts/models.py Subscription.PLAN_PRICE_UZS bilan
// bir xil bo'lishi shart — u yerda o'zgarsa, shu yerni ham yangilang.
export const PLANS = [
  {
    id: "beta",
    name: "Beta",
    price: 0,
    period: "hamisha bepul",
    highlight: false,
    points: [
      "1 farzand, 2 qurilmagacha",
      "Kunlik limit, dam olish vaqti, ilova cheklovi",
      "7 kunlik faoliyat tarixi",
      "Kuniga 3 marta ekran rasmi",
      "Telegram bot mini-paneli",
    ],
    cta: "Bepul boshlash",
  },
  {
    id: "mini",
    name: "Mini",
    price: 15000,
    period: "oyiga",
    highlight: true,
    points: [
      "2 farzand, 4 qurilmagacha",
      "30 kunlik faoliyat tarixi + CSV eksport",
      "Kuniga 10 marta ekran rasmi",
      "Barcha ogohlantirishlar",
      "Beta'dagi hammasi",
    ],
    cta: "Mini'ga o'tish",
  },
  {
    id: "max",
    name: "Max",
    price: 25000,
    period: "oyiga",
    highlight: false,
    points: [
      "Cheksiz farzand va qurilma",
      "Cheksiz faoliyat tarixi",
      "Cheksiz ekran rasmi",
      "AI tahlil — chiqqanda birinchi bo'lib",
      "Mini'dagi hammasi",
    ],
    cta: "Max'ga o'tish",
  },
] as const;

export const PLATFORMS = [
  {
    icon: "solar:monitor-linear",
    tag: "Bola qurilmasi",
    title: "Windows agent",
    body:
      "Windows xizmati sifatida ishlaydi, qoidalarni lokal qo'llaydi. Tray status oynasi, xushmuomala bloklash ekrani, OTA orqali avto-yangilanish.",
    status: "Mavjud",
  },
  {
    icon: "solar:window-frame-linear",
    tag: "Ota-ona",
    title: "Web panel",
    body:
      "Kundalik holat, faoliyat, qoidalar va xabarlar. Bir nechta bola va qurilma. Telegram bot orqali panelni ochmasdan nazorat.",
    status: "Mavjud",
  },
  {
    icon: "solar:smartphone-linear",
    tag: "Ota-ona",
    title: "Mobil ilova",
    body:
      "Telegram botni oching — ilova o'zi ichida ochiladi, alohida o'rnatish shart emas. Kunlik holat, haftalik statistika, qurilmalar va xabarlar bir joyda.",
    status: "Mavjud",
  },
];

export const FAQ = [
  {
    q: "Aynan nimalar kuzatiladi?",
    a:
      "Faol ilova nomi va undan foydalanish vaqti, tashrif buyurilgan sayt domeni (masalan youtube.com — to'liq havola emas), qurilma holati va qoida hodisalari. Boshqa hech narsa.",
  },
  {
    q: "Skrinshot yoki klaviatura yozuvi olinadimi?",
    a:
      "Doimiy ekran yozuvi yoki avtomatik skrinshot — yo'q. Klaviatura bosilishi, mikrofon, to'liq havolalar, sahifa mazmuni va shaxsiy xabarlar hech qachon yozilmaydi. Faqat bitta imkoniyat bor: siz istalgan vaqt bitta tugma bosib ayni damdagi ekran rasmini ko'rishingiz mumkin — bu avtomatik emas, bola har safar buni ko'radi, va rasm siz tanlagan muddatdan (1 kun/hafta/oy) keyin o'zi o'chadi.",
  },
  {
    q: "Bola dasturni o'chira oladimi?",
    a:
      "Agent Windows xizmati sifatida ishlaydi va oddiy foydalanuvchi uni to'xtata olmaydi. Lekin u yashirin emas — bola tray belgisini va status oynasini ko'radi. O'chirishni ota-ona qiladi.",
  },
  {
    q: "Windows agent qanday ishlaydi?",
    a:
      "Kichik fon xizmati qaysi ilova faol ekanini va qancha vaqt ishlatilganini kuzatadi, qoidalarni lokal qo'llaydi va ma'lumotni panelga yuboradi. Limit yoki dam olish vaqti kelganda ekranga xushmuomala bloklash oynasi chiqadi.",
  },
  {
    q: "Internet bo'lmasa ishlaydimi?",
    a:
      "Ha. Qoidalar lokal agentda saqlanadi va offline ham qo'llanadi. Ma'lumot internet qaytganda sinxronlanadi.",
  },
  {
    q: "Bir nechta bola yoki qurilma bo'lsa-chi?",
    a:
      "Bitta oila hisobiga bir nechta bola va qurilma bog'lanadi. Panelda har bola alohida ko'rinadi, haftalik solishtirma bilan.",
  },
  {
    q: "Mobil ilova qanday o'rnatiladi?",
    a:
      "Alohida o'rnatish shart emas — @ChaqimchiGuardBot'ni oching, «Ota-ona paneli» tugmasini bosing, ilova Telegram ichida ochiladi. App Store yoki Play Market kerak emas.",
  },
  {
    q: "Ro'yxatdan qanday o'taman, nega telefon raqami so'raladi?",
    a:
      "@ChaqimchiGuardBot'da /start bosing — hisobingiz shu zahoti yaratiladi. Telefon raqamini Telegram'ning o'z tugmasi orqali yuborasiz (yozib kiritilmaydi) — bu hisobingizni himoyalaydi va kerak bo'lganda yordam ko'rsatish uchun ishlatiladi, boshqa hech kimga berilmaydi.",
  },
  {
    q: "Windows «Noma'lum noshir» deb ogohlantirsa nima qilaman?",
    a:
      "Dastur hozircha kod bilan imzolanmagan (MVP/Beta). SmartScreen oynasida «More info» → «Run anyway». Defender, SmartScreen yoki UAC'ni o'chirish shart emas va tavsiya qilinmaydi.",
  },
  {
    q: "Narxi qancha?",
    a:
      "Beta — hamisha bepul (1 farzand, 2 qurilma). Mini — 15,000 so'm/oy (2 farzand, 4 qurilma, 30 kunlik tarix). Max — 25,000 so'm/oy (cheksiz farzand/qurilma, AI tahlil chiqqanda birinchi bo'lib). To'lov Telegram botdagi «💳 Obuna» tugmasi orqali, Payme yoki Click bilan.",
  },
];
