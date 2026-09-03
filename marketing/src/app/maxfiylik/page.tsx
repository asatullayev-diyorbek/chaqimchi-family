import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati",
  description: "ChaqimchiAI Family qanday ma’lumot to’playdi va nimani hech qachon to’plamaydi.",
};

export default function Page() {
  return (
    <LegalPage title="Maxfiylik siyosati" updated="2026-09-03">
      <p>
        ChaqimchiAI Family — ota-ona va bola o’rtasidagi ekran-vaqt qoidalarini
        ochiq boshqarish vositasi. Biz faqat shu vazifa uchun zarur bo’lgan
        ma’lumotni to’playmiz.
      </p>

      <h2>To’planadigan ma’lumot</h2>
      <ul>
        <li>Ota-ona hisobi: elektron pochta yoki foydalanuvchi nomi, parol xeshi, ixtiyoriy Telegram ulanishi.</li>
        <li>Qurilma faoliyati: faol ilova/oyna nomi va undan foydalanish davomiyligi.</li>
        <li>Qurilma holati: batareya foizi, oxirgi ulanish vaqti, agent versiyasi.</li>
        <li>Qoida hodisalari: limit tugashi, cheklangan ilova ochilishi, «Kattalar uchun» panel ochilishi.</li>
      </ul>

      <h2>Hech qachon to’planmaydi</h2>
      <ul>
        <li>Skrinshot yoki ekran yozuvi.</li>
        <li>Klaviatura bosilishi (keylogging).</li>
        <li>Mikrofon yoki kamera yozuvi.</li>
        <li>Shaxsiy xabarlar, brauzer parollari yoki fayl mazmuni.</li>
      </ul>

      <h2>Ma’lumot qayerda saqlanadi</h2>
      <p>
        Qoidalar va hisoblash bola qurilmasidagi lokal agentda ishlaydi va
        offline ham qo’llanadi. Faoliyat ma’lumoti ota-ona paneliga
        sinxronlanadi va serverda oila hisobiga bog’langan holda saqlanadi.
        Ma’lumot uchinchi tomonlarga sotilmaydi.
      </p>

      <h2>Bolaning huquqi</h2>
      <p>
        Bola qurilmasida agent yashirin emas: tray belgisi, status oynasi va
        bloklash ekrani orqali bola nima kuzatilishini va qanday qoidalar
        borligini ko’radi.
      </p>

      <h2>O’chirish</h2>
      <p>
        Ota-ona hisobni yoki qurilmani istalgan vaqtda o’chirishi mumkin.
        Qurilma o’chirilganda unga bog’liq faoliyat ma’lumoti ham o’chiriladi.
      </p>
    </LegalPage>
  );
}
