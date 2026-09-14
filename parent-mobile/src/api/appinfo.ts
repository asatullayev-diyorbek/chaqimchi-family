// "Ilova haqida" — a parent-friendly explanation of one installed app,
// cached globally on Django (not per-child — see apps/appinfo on the
// server) and generated on demand the same way AI tahlil is: this client
// asks Vercel's relay directly (it verifies the caller via Django's
// /api/auth/me/, so there's no separate relay secret to embed in the app),
// then stores the result back on Django for every family to reuse.
import { apiFetch, ApiError, getValidAccessToken } from "./client";

export type AppInfo = {
  key: string;
  display_name: string;
  category: string;
  description: string;
  benefits: string[];
  risks: string[];
  age_note: string;
  created_at: string;
};

const RELAY_URL =
  process.env.EXPO_PUBLIC_APPINFO_RELAY_URL ?? "https://guard.spino24.uz/api/appinfo-relay";

export function getAppInfo(appName: string): Promise<AppInfo | null> {
  return apiFetch<AppInfo>(`/api/app-info/${encodeURIComponent(appName)}/`).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
}

export type AppInfoSummary = Pick<AppInfo, "display_name" | "category">;

/** category/display_name only, for every app name that has a cached entry —
 * one request for a whole installed-apps list instead of one per row. Apps
 * with no cached entry are simply absent from the result. */
export function getAppInfoBulk(appNames: string[]): Promise<Record<string, AppInfoSummary>> {
  if (appNames.length === 0) return Promise.resolve({});
  const keys = [...new Set(appNames.map((n) => n.trim().toLowerCase()))].join(",");
  return apiFetch(`/api/app-info/bulk/?keys=${encodeURIComponent(keys)}`);
}

export async function generateAppInfo(appName: string, publisher: string): Promise<AppInfo> {
  const token = await getValidAccessToken();
  if (!token) throw new ApiError("Sessiya tugagan, qayta kiring.", 401);

  const res = await fetch(RELAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ app_name: appName, publisher }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.detail ?? body.error ?? "Ma'lumot topilmadi", res.status);
  }

  return apiFetch<AppInfo>(`/api/app-info/${encodeURIComponent(appName)}/submit/`, {
    method: "POST",
    body: JSON.stringify(body.result),
  });
}
