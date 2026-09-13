// Groq inference for "AI tahlil" weekly insights — lives here (Vercel), not
// in the Django backend, because PythonAnywhere Free's outbound internet is
// restricted to a fixed whitelist that api.groq.com's Cloudflare front-end
// rejects by IP/ASN even when PA's own proxy lets the connection through
// (confirmed by hand: HTTP 403 "error code: 1010"). Vercel's egress isn't
// affected, so every Groq call — on-demand (via /api/groq-relay, called by
// the client) and proactive weekly (via /api/weekly-insight-cron, called by
// an external cron) — happens from here instead.

export type RiskLevel = "ok" | "watch" | "concern";
export type Period = "last_week" | "this_week" | "today";

export type WeekData = {
  child_name: string;
  week_start: string;
  week_end: string;
  total_minutes: number;
  daily_minutes: Record<string, number>;
  top_apps: { name: string; minutes: number }[];
  top_domains: { domain: string; visits: number }[];
  alerts: Record<string, number>;
  rules: { rule_type: string; value: unknown }[];
  period: Period;
  // this_week/today are necessarily still in progress — the prompt must
  // say so, or the model narrates an unfinished period as a finished one
  // ("bu hafta jami X daqiqa sarfladi" about a week that's only half over).
  is_partial: boolean;
};

export type InsightResult = {
  summary: string;
  highlights: string[];
  recommendations: string[];
  risk_level: RiskLevel;
};

const SYSTEM_PROMPT = `Siz Spino24 — bolalar uchun raqamli xavfsizlik dasturidagi yordamchisiz. Ota-onaga farzandining ekran faoliyati haqida qisqa, tushunarli va hukm qilmaydigan tahlil bering. Har doim o'zbek tilida, iliq va hamkorlik ruhida yozing — bolani ayblamang, ota-onaga amaliy tavsiyalar bering.

Tahlil qilinayotgan davr hali tugamagan bo'lishi mumkin (masalan, "shu hafta" yoki "bugun") — bunday holda buni tugallangan davrdek emas, hali davom etayotgan davr sifatida tasvirlang (masalan, "shu haftaning hozirgacha bo'lgan qismida" kabi), va son/foizlarni "hozirgacha" degan ma'noda bering.

Faqat quyidagi JSON formatida javob bering, boshqa hech narsa yozmang:
{"summary": "2-3 gapli umumiy holat", "highlights": ["diqqatga molik narsa 1", "..."], "recommendations": ["amaliy tavsiya 1", "..."], "risk_level": "ok" | "watch" | "concern"}`;

const PERIOD_LABEL: Record<Period, string> = {
  last_week: "O'tgan hafta (to'liq tugagan)",
  this_week: "Shu hafta (hali tugamagan, dushanbadan bugungi kungacha)",
  today: "Bugun (kun hali davom etmoqda)",
};

function buildUserPrompt(week: WeekData): string {
  return [
    `Farzand: ${week.child_name}`,
    `Davr: ${PERIOD_LABEL[week.period] ?? week.period} — ${week.week_start} — ${week.week_end}`,
    week.is_partial ? "Diqqat: bu davr hali tugamagan, ma'lumot faqat hozirgacha bo'lgan qismni qamrab oladi." : "",
    `Jami ekran vaqti: ${week.total_minutes} daqiqa`,
    `Kunlar bo'yicha (daqiqa): ${JSON.stringify(week.daily_minutes)}`,
    `Eng ko'p ishlatilgan ilovalar: ${JSON.stringify(week.top_apps)}`,
    `Eng ko'p tashrif buyurilgan saytlar: ${JSON.stringify(week.top_domains)}`,
    `Ogohlantirishlar (turi -> soni): ${JSON.stringify(week.alerts)}`,
    `O'rnatilgan qoidalar: ${JSON.stringify(week.rules)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Calls Groq directly (this function only ever runs on Vercel — the
 * weekly cron route). Returns null on any failure; never throws, matching
 * the rest of this project's "external calls are best-effort" posture. */
export async function generateWeeklyInsight(week: WeekData): Promise<InsightResult | null> {
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
          { role: "user", content: buildUserPrompt(week) },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return normalizeResult(parsed);
  } catch {
    return null;
  }
}

export function normalizeResult(parsed: any): InsightResult | null {
  const summary = String(parsed?.summary ?? "").trim();
  if (!summary) return null;
  const riskLevel: RiskLevel = ["ok", "watch", "concern"].includes(parsed?.risk_level)
    ? parsed.risk_level
    : "ok";
  return {
    summary,
    highlights: Array.isArray(parsed?.highlights) ? parsed.highlights.map(String).slice(0, 10) : [],
    recommendations: Array.isArray(parsed?.recommendations)
      ? parsed.recommendations.map(String).slice(0, 10)
      : [],
    risk_level: riskLevel,
  };
}

export { SYSTEM_PROMPT, buildUserPrompt };
