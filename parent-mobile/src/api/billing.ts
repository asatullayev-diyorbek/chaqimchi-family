import { apiFetch } from "./client";

export type PlanId = "beta" | "mini" | "max";
export type Provider = "payme" | "click";

export type PlanFeatures = {
  max_children: number | null;
  max_devices: number | null;
  history_days: number | null;
  screenshot_daily_limit: number | null;
  ai_analysis: boolean;
};

export type Plan = {
  plan: PlanId;
  label: string;
  price_uzs: number;
  features: PlanFeatures;
};

export type BillingStatus = {
  plan: PlanId;
  plan_label: string;
  status: "active" | "expired" | "canceled";
  expires_at: string | null;
  usage: {
    children: number;
    children_limit: number | null;
    devices: number;
    devices_limit: number | null;
  };
  providers_available: { payme: boolean; click: boolean };
  payme_test_mode: boolean;
};

export type CheckoutResult = {
  invoice_id: string;
  amount_uzs: number;
  checkout_url: string;
};

export function getPlans(): Promise<Plan[]> {
  return apiFetch("/api/billing/plans/");
}

export function getBillingStatus(): Promise<BillingStatus> {
  return apiFetch("/api/billing/status/");
}

export function checkout(plan: PlanId, provider: Provider): Promise<CheckoutResult> {
  return apiFetch("/api/billing/checkout/", {
    method: "POST",
    body: JSON.stringify({ plan, provider }),
  });
}
