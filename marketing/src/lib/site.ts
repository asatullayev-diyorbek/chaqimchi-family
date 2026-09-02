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
} as const;

export const PROMISES = [
  {
    icon: "M12 2 3 6v6c0 5 4 9 9 10 5-1 9-5 9-10V6l-9-4Z",
    title: "Shaffoflik",
    body:
      "Bola agent borligini, qanday ma'lumot olinishini va qoidalar nima ekanini ko'radi. Yashirin rejim yo'q.",
  },
  {
    icon: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    title: "Xotirjam boshqaruv",
    body:
      "Ota-ona holatni va qoidalarni oddiy tilda, bir necha bosishda boshqaradi. Jazo emas — kelishuv.",
  },
  {
    icon: "M3 12h4l3 8 4-16 3 8h4",
    title: "Offline barqarorlik",
    body:
      "Qoidalar va hisoblash lokal agentda ishlaydi. Internet uzilsa ham bola tajribasi buzilmaydi.",
  },
];

export const FEATURES = [
  {
    tag: "Limit",
    title: "Kunlik ekran vaqti",
    body:
      "Kuniga necha daqiqa. Ish kunlari va dam olish kunlari (Sh–Ya) uchun alohida qiymat qo'yish mumkin.",
  },
  {
    tag: "Tinch soatlar",
    title: "Dam olish vaqti oynalari",
    body:
      "Masalan 22:00–07:00 — bu oraliqda ekran xushmuomala ekran bilan bloklanadi, ertaga o'zi ochiladi.",
  },
  {
    tag: "Ilovalar",
    title: "Ayrim ilovalarni cheklash",
    body:
      "Nomi bo'yicha cheklang. Bola ilovasi buni «hozircha mavjud emas» holati sifatida ko'rsatadi.",
  },
  {
    tag: "Faoliyat",
    title: "Nima, qancha vaqt",
    body:
      "Qaysi ilova qancha ishlatilgani — ikonkasi bilan. Kun / hafta / oy kesimida, CSV eksport bilan.",
  },
  {
    tag: "Alert",
    title: "Muhim ogohlantirishlar",
    body:
      "Limit tugadi, cheklangan ilova ochildi, qurilmada «Kattalar uchun» paneli ochildi — darhol xabar.",
  },
  {
    tag: "Telegram",
    title: "Telegram bot + kunlik hisobot",
    body:
      "Panelni ochmasdan @ChaqimchiGuardBot orqali bugungi holat, qurilmalar va har oqshom qisqa hisobot.",
  },
];

export const STEPS = [
  {
    n: "1",
    title: "O'rnat va bog'la",
    body:
      "Windows dasturini yuklab oling. Rozilik oynasidan so'ng ekrandagi QR kodni mobil ilova bilan skanerlang yoki 6 xonali kodni kiriting.",
  },
  {
    n: "2",
    title: "Qoidalarni belgila",
    body:
      "Web panel yoki mobil ilovada kunlik limit, dam olish vaqti va cheklangan ilovalarni sozlang. O'zgarishlar qurilmaga o'zi yetadi.",
  },
  {
    n: "3",
    title: "Xotirjam kuzat",
    body:
      "Kundalik holat, faoliyat va alertlar bir joyda. Bola ham o'z ekranida qoidalar va qolgan vaqtни ko'rib turadi.",
  },
];

export const FAQ = [
  {
    q: "Windows «Noma'lum noshir» deb ogohlantirsa nima qilaman?",
    a:
      "Dastur hozircha kod bilan imzolanmagan (MVP/Beta). SmartScreen oynasida «More info» → «Run anyway». Defender, SmartScreen yoki UAC'ni o'chirish shart emas va tavsiya qilinmaydi.",
  },
  {
    q: "Aynan nima yoziladi?",
    a:
      "Faol ilova nomi va undan foydalanish vaqti, qurilma holati (batareya, oxirgi ulanish), qoida hodisalari. Klaviatura bosilishi, skrinshot, mikrofon yoki shaxsiy xabarlar — yo'q.",
  },
  {
    q: "Bola dasturni o'chira oladimi?",
    a:
      "Agent Windows xizmati sifatida ishlaydi va oddiy foydalanuvchi uni to'xtata olmaydi. Lekin u yashirin emas — bola tray belgisini va status oynasini ko'radi. O'chirishni ota-ona qiladi.",
  },
  {
    q: "Internet bo'lmasa ishlaydimi?",
    a:
      "Ha. Qoidalar lokal agentda saqlanadi va offline ham qo'llanadi. Ma'lumot internet qaytganda sinxronlanadi.",
  },
  {
    q: "Bir nechta bola / qurilma bo'lsa-chi?",
    a:
      "Bitta oila hisobiga bir nechta bola va qurilma bog'lanadi. Panelda har bola alohida ko'rinadi, haftalik solishtirma bilan.",
  },
  {
    q: "Narxi qancha?",
    a:
      "MVP/Beta davrida bepul. Keyinchalik oilaviy obuna bo'ladi — mavjud sinov foydalanuvchilari oldindan xabardor qilinadi.",
  },
];
