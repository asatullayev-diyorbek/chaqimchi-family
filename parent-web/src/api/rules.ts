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

export async function createRule(
  deviceId: string,
  ruleType: RuleType,
  value: Rule["value"]
): Promise<Rule> {
  return apiFetch(`/api/rules/${deviceId}/`, {
    method: "POST",
    body: JSON.stringify({ rule_type: ruleType, value }),
  });
}

export async function deleteRule(ruleId: string): Promise<void> {
  await apiFetch(`/api/rules/${ruleId}/`, { method: "DELETE" });
}

export function getDailyLimitMinutes(rules: Rule[]): number | null {
  const rule = rules.find((r) => r.rule_type === "daily_limit_minutes");
  if (!rule || !("minutes" in rule.value)) return null;
  return rule.value.minutes;
}
