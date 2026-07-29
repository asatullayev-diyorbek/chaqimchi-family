import { apiFetch } from "./client";

export type RuleType = "daily_limit_minutes" | "blocked_app";

export type Rule = {
  id: string;
  device: string;
  rule_type: RuleType;
  value: { minutes: number } | { app: string };
  created_at: string;
};

export async function getRules(deviceId: string): Promise<Rule[]> {
  return apiFetch(`/api/rules/${deviceId}/`);
}

export function getDailyLimitMinutes(rules: Rule[]): number | null {
  const rule = rules.find((r) => r.rule_type === "daily_limit_minutes");
  if (!rule || !("minutes" in rule.value)) return null;
  return rule.value.minutes;
}
