import { apiFetch } from "./client";

export type RuleType = "daily_limit_minutes" | "blocked_app" | "blocked_window";

export type DailyLimitValue = { minutes: number; weekend_minutes?: number };
export type BlockedAppValue = { app: string };
export type BlockedWindowValue = { start: string; end: string };

export type Rule = {
  id: string;
  device: string;
  rule_type: RuleType;
  value: DailyLimitValue | BlockedAppValue | BlockedWindowValue;
  created_at: string;
};

export function getRules(deviceId: string): Promise<Rule[]> {
  return apiFetch(`/api/rules/${deviceId}/`);
}

export function createRule(
  deviceId: string,
  rule_type: RuleType,
  value: Rule["value"],
): Promise<Rule> {
  return apiFetch(`/api/rules/${deviceId}/`, {
    method: "POST",
    body: JSON.stringify({ rule_type, value }),
  });
}

export async function deleteRule(ruleId: string): Promise<void> {
  await apiFetch(`/api/rules/${ruleId}/`, { method: "DELETE" });
}

// --- selectors ---

export function dailyLimitRule(rules: Rule[]): (Rule & { value: DailyLimitValue }) | null {
  const r = rules.find((x) => x.rule_type === "daily_limit_minutes");
  return r && "minutes" in r.value ? (r as Rule & { value: DailyLimitValue }) : null;
}

export function getDailyLimitMinutes(rules: Rule[]): number | null {
  return dailyLimitRule(rules)?.value.minutes ?? null;
}

export function getWeekendLimitMinutes(rules: Rule[]): number | null {
  return dailyLimitRule(rules)?.value.weekend_minutes ?? null;
}

export function blockedApps(rules: Rule[]): (Rule & { value: BlockedAppValue })[] {
  return rules.filter(
    (r) => r.rule_type === "blocked_app" && "app" in r.value,
  ) as (Rule & { value: BlockedAppValue })[];
}

export function blockedWindows(rules: Rule[]): (Rule & { value: BlockedWindowValue })[] {
  return rules.filter(
    (r) => r.rule_type === "blocked_window" && "start" in r.value,
  ) as (Rule & { value: BlockedWindowValue })[];
}
