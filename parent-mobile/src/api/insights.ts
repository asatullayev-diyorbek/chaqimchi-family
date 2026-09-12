import { apiFetch } from "./client";

export type RiskLevel = "ok" | "watch" | "concern";

export type WeeklyInsight = {
  week_start: string;
  summary: string;
  highlights: string[];
  recommendations: string[];
  risk_level: RiskLevel;
  created_at: string;
};

export function getWeeklyInsight(childId: string, refresh = false): Promise<WeeklyInsight> {
  return apiFetch(`/api/insights/${childId}/${refresh ? "?refresh=1" : ""}`);
}
