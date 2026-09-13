// "Ilova haqida" — a parent-friendly explanation of one installed app
// (what it is, its benefits/risks for a child), generated via Groq the same
// way src/lib/groq.ts generates weekly insights, and for the same reason:
// PythonAnywhere's outbound IPs can't reach api.groq.com. Unlike weekly
// insights this content isn't personal — "roblox.exe" means the same thing
// for every family — so Django caches one row per app key globally rather
// than per child (see apps/appinfo).

export type AppInfoResult = {
  display_name: string;
  category: string;
  description: string;
  benefits: string[];
  risks: string[];
  age_note: string;
};

const SYSTEM_PROMPT = `Siz Spino24 — bolalar uchun raqamli xavfsizlik dasturidagi yordamchisiz. Sizga bolaning qurilmasida topilgan bitta dasturning texnik nomi (exe/paket nomi) va ishlab chiqaruvchisi beriladi — bular odatda ingliz tilida bo'ladi. Vazifangiz: bu dastur aslida qanday mashhur ilova ekanini aniqlash (masalan "RobloxPlayerBeta.exe" — Roblox), va ota-onaga tushunarli, qisqa tarzda uning nima ekani, foydali va xavfli tomonlarini tushuntirish.

MUHIM — TIL: kirish (dastur nomi, ishlab chiqaruvchi) ingliz tilida bo'lishidan qat'i nazar, description, benefits, risks, category va age_note maydonlaridagi BUTUN matn faqat va har doim o'zbek tilida bo'lishi SHART. Hech qachon inglizcha gap yoki jumla yozmang. Faqat display_name'da ilovaning haqiqiy nomi (masalan "Roblox", "TikTok") o'z original yozilishida qoladi — bu tarjima qilinmaydi, chunki bu atoqli ot.

Hukm chiqarmang, qo'rqitmang — balanslangan, ma'lumot beruvchi ohangda yozing. Agar dastur nomini aniq tanimasangiz, texnik nom asosida eng oqilona taxminni bering va umumiy tavsifni ham o'zbek tilida yozing (masalan tizim komponenti bo'lsa, shuni ayting).

Faqat quyidagi JSON formatida javob bering, boshqa hech narsa yozmang:
{"display_name": "Ilovaning taniqli nomi (original yozilishida)", "category": "toifasi — o'zbek tilida (masalan: O'yin, Ijtimoiy tarmoq, Brauzer, Ta'lim, Tizim dasturi)", "description": "2-3 gapli tushuntirish (o'zbek tilida): bu nima va nima uchun ishlatiladi", "benefits": ["foydali tomoni 1 (o'zbek tilida)", "..."], "risks": ["xavfli/salbiy tomoni 1 (o'zbek tilida)", "..."], "age_note": "yosh bo'yicha qisqa tavsiya (o'zbek tilida)"}`;

function buildUserPrompt(appName: string, publisher: string): string {
  return [`Dastur fayli: ${appName}`, publisher ? `Ishlab chiqaruvchi: ${publisher}` : ""]
    .filter(Boolean)
    .join("\n");
}

export async function generateAppInfo(appName: string, publisher: string): Promise<AppInfoResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!apiKey || !model) return null;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(appName, publisher) },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return normalizeAppInfo(parsed, appName);
  } catch {
    return null;
  }
}

export function normalizeAppInfo(parsed: any, fallbackName: string): AppInfoResult | null {
  const description = String(parsed?.description ?? "").trim();
  if (!description) return null;
  return {
    display_name: String(parsed?.display_name ?? fallbackName).trim() || fallbackName,
    category: String(parsed?.category ?? "").trim(),
    description,
    benefits: Array.isArray(parsed?.benefits) ? parsed.benefits.map(String).slice(0, 8) : [],
    risks: Array.isArray(parsed?.risks) ? parsed.risks.map(String).slice(0, 8) : [],
    age_note: String(parsed?.age_note ?? "").trim(),
  };
}
