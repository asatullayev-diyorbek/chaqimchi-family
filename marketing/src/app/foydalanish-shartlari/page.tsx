import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Foydalanish shartlari",
  description: "ChaqimchiAI Family MVP/Beta davridagi foydalanish shartlari.",
};

export default function Page() {
  return (
    <LegalPage title="Foydalanish shartlari" updated="2026-09-03">
      <p>
        ChaqimchiAI Family hozircha MVP/Beta bosqichida. Xizmatdan foydalanish
        orqali quyidagilarga rozilik bildirasiz.
      </p>

      <h2>Maqsadli foydalanish</h2>
      <p>
        Xizmat faqat o’z farzandingiz qurilmasidagi ekran-vaqt qoidalarini
        boshqarish uchun mo’ljallangan. Uni boshqa shaxsni uning xabari yoki
        roziligisiz kuzatish uchun ishlatish taqiqlanadi.
      </p>

      <h2>Beta holati</h2>
      <ul>
        <li>Xizmat «boricha» taqdim etiladi; uzilishlar yoki xatoliklar bo’lishi mumkin.</li>
        <li>Windows dasturi hozircha kod bilan imzolanmagan.</li>
        <li>Imkoniyatlar ogohlantirishsiz o’zgarishi mumkin.</li>
      </ul>

      <h2>Narx</h2>
      <p>
        MVP/Beta davrida xizmat bepul. Kelajakda oilaviy obuna joriy etilsa,
        mavjud foydalanuvchilar oldindan xabardor qilinadi.
      </p>

      <h2>Hisob</h2>
      <p>
        Hisob xavfsizligi va unga bog’langan qurilmalardagi qoidalar uchun
        ota-ona javobgar. Hisobni istalgan vaqtda o’chirish mumkin.
      </p>

      <h2>Javobgarlik</h2>
      <p>
        ChaqimchiAI xizmatdan foydalanish natijasida yuzaga kelgan bilvosita
        zararlar uchun javobgar emas. Xizmat ota-ona nazoratini o’rnini
        bosmaydi — u yordamchi vosita.
      </p>
    </LegalPage>
  );
}
