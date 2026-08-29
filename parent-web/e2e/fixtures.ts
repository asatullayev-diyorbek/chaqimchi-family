import { Page } from "@playwright/test";

/**
 * A signed-in parent with mocked backend data.
 *
 * Everything under /api/ is intercepted, so the suite needs no server and
 * creates no real accounts — earlier manual testing against production left
 * throwaway parents behind that had to be cleaned up by hand. It also means
 * empty/populated/error states are set up by choosing a fixture, not by
 * arranging data somewhere.
 */

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** getAccessToken() parses the payload segment, so this must be a real JWT shape. */
export function validToken(): string {
  return [b64({ alg: "HS256" }), b64({ exp: Math.floor(Date.now() / 1000) + 3600 }), "sig"].join(".");
}

export const CHILD = { id: "c1", name: "Alijon", birth_date: "2013-02-02", photo_url: "", created_at: "2026-08-01T00:00:00Z", device_count: 1 };

// Fixed instants, not Date.now() offsets: rendered timestamps are part of the
// visual baselines, so a fixture that drifts makes them fail on their own.
export const NOW = new Date("2026-08-29T15:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

export const DEVICE = {
  id: "d1", child_id: "c1", child_name: "Alijon", platform: "windows",
  status: "linked", created_at: "2026-08-01T00:00:00Z",
  linked_at: "2026-08-01T00:00:00Z", last_sync: minutesAgo(2),
  agent_version: "0.4.0-rc.1",
};

/** A second device for the same child — the multi-device case. */
export const PHONE = {
  id: "d2", child_id: "c1", child_name: "Alijon", platform: "android",
  status: "linked", created_at: "2026-08-05T00:00:00Z",
  linked_at: "2026-08-05T00:00:00Z", last_sync: minutesAgo(12),
  agent_version: "0.4.0-rc.1",
};

export const SUMMARY = {
  device_id: "d1", child_name: "Alijon", child_birth_date: "2013-02-02", child_photo_url: "",
  date: NOW.toISOString().slice(0, 10),
  total_screen_minutes: 221,
  top_apps: [
    { app: "chrome.exe", minutes: 141, last_used_at: minutesAgo(10), icon: null },
    { app: "code.exe", minutes: 65, last_used_at: minutesAgo(90), icon: null },
    { app: "explorer.exe", minutes: 15, last_used_at: minutesAgo(200), icon: null },
  ],
  device_status: "online", last_sync: minutesAgo(2),
  agent_version: "0.4.0-rc.1", battery_percent: 62, battery_updated_at: minutesAgo(2),
  breakdown: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(NOW.getTime() - (6 - i) * 864e5).toISOString().slice(0, 10),
    total_minutes: [18, 25, 32, 41, 72, 151, 221][i],
  })),
};

/** 14 alerts so the 10-per-page pagination has a second page to show. */
export const ALERTS = Array.from({ length: 14 }, (_, i) => ({
  id: `a${i}`,
  device: "d1",
  alert_type: i % 2 ? "limit_reached" : "blocked_app_opened",
  payload: { app: "steam.exe" },
  triggered_at: new Date(NOW.getTime() - i * 36e5).toISOString(),
  seen: i > 3,
}));

export async function signIn(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem("chaqimchi_access_token", token);
    localStorage.setItem("chaqimchi_refresh_token", "refresh");
  }, validToken());
}

export async function mockApi(page: Page, overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    "/api/auth/me/": { id: 1, email: null, username: "diyorbek", full_name: "Diyorbek Asatullayev", telegram_username: "", family: "f1", created_at: "2026-08-01T00:00:00Z" },
    "/api/devices/": [DEVICE],
    "/api/children/": [CHILD],
    "/api/tracking/summary/": SUMMARY,
    "/api/tracking/history/": { results: [], count: 0, limit: 10, offset: 0, next_offset: null },
    "/api/tracking/timeline/": { date: SUMMARY.date, segments: [] },
    "/api/alerts/": ALERTS,
    "/api/rules/": [],
    ...overrides,
  };

  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) return route.fulfill({ status: 404, body: "{}" });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(routes[key]),
    });
  });
}
