// "AI tahlil" — Django never calls Groq itself (PythonAnywhere's outbound
// internet can't reach it), so on-demand generation is orchestrated from
// right here: read the cached insight for a period; if there isn't one, ask
// Vercel's relay to generate it (it fetches the period's data bundle from
// Django using this client's own access token, so there's no separate
// relay secret to embed in the app) and store the result back on Django.
import { apiFetch, ApiError, getValidAccessToken } from "./client";

export type RiskLevel = "ok" | "watch" | "concern";
export type Period = "last_week" | "this_week" | "today";

export type WeeklyInsight = {
  period: Period;
  week_start: string;
  summary: string;
  highlights: string[];
  recommendations: string[];
  risk_level: RiskLevel;
  created_at: string;
};

const RELAY_URL =
  process.env.EXPO_PUBLIC_GROQ_RELAY_URL ?? "https://guard.chaqimchi-ai.uz/api/groq-relay";

export function getCachedInsight(
  childId: string,
  period: Period = "last_week",
): Promise<WeeklyInsight | null> {
  return apiFetch<WeeklyInsight>(`/api/insights/${childId}/?period=${period}`).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
}

export async function generateInsight(
  childId: string,
  period: Period = "last_week",
): Promise<WeeklyInsight> {
  const token = await getValidAccessToken();
  if (!token) throw new ApiError("Sessiya tugagan, qayta kiring.", 401);

  const res = await fetch(RELAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ child_id: childId, period }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.detail ?? body.error ?? "Tahlil yaratib bo'lmadi", res.status);
  }

  return apiFetch<WeeklyInsight>(`/api/insights/${childId}/submit/`, {
    method: "POST",
    body: JSON.stringify({ ...body.result, period }),
  });
}
