// One place for every outbound URL and headline constant the landing page
// uses, so copy changes don't mean hunting through components.

export const SITE = {
  name: "ChaqimchiAI Family",
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
    title: "Telegram bot + kunlik hisobot",
    body:
      "Panelni ochmasdan @ChaqimchiGuardBot orqali bugungi holat, qurilmalar va har oqshom qisqa hisobot.",
    icon: "solar:plain-2-linear",
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
  "Qurilma holati",
  "Qoida hodisalari",
];

export const DATA_NOT_COLLECTED = [
  "Skrinshot",
  "Klaviatura yozuvi",
  "Mikrofon",
  "Shaxsiy xabarlar",
  "Brauzer tarixi mazmuni",
];

export const PRICING = [
  "Kunlik limit (ish kuni / dam olish kuni)",
  "Dam olish vaqti oynalari",
  "Ilova cheklovlari",
  "Bir nechta bola va qurilma",
  "Faoliyat tarixi",
  "CSV eksport",
  "Telegram bot va kunlik hisobot",
  "Avtomatik yangilanish",
];

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
      "Telefondan bir qarashda kunlik holat, haftalik statistika va xabarlar. Hozir yopiq sinovda.",
    status: "Tez orada",
  },
];

export const FAQ = [
  {
    q: "Aynan nimalar kuzatiladi?",
    a:
      "Faol ilova nomi va undan foydalanish vaqti, qurilma holati (batareya, oxirgi ulanish) hamda qoida hodisalari — masalan limit tugashi. Boshqa hech narsa.",
  },
  {
    q: "Skrinshot yoki klaviatura yozuvi olinadimi?",
    a:
      "Yo'q. Skrinshot, klaviatura bosilishi, mikrofon va shaxsiy xabarlar hech qachon yozilmaydi. Bu mahsulotning asosiy tamoyili.",
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
    q: "Mobil ilova qachon chiqadi?",
    a:
      "Ota-ona uchun mobil ilova hozir yopiq sinovda. Hozircha nazoratni web panel va Telegram bot orqali to'liq amalga oshirasiz.",
  },
  {
    q: "Windows «Noma'lum noshir» deb ogohlantirsa nima qilaman?",
    a:
      "Dastur hozircha kod bilan imzolanmagan (MVP/Beta). SmartScreen oynasida «More info» → «Run anyway». Defender, SmartScreen yoki UAC'ni o'chirish shart emas va tavsiya qilinmaydi.",
  },
  {
    q: "Narxi qancha?",
    a:
      "MVP/Beta davrida bepul. Keyinchalik oilaviy obuna bo'ladi — mavjud sinov foydalanuvchilari oldindan xabardor qilinadi.",
  },
];
