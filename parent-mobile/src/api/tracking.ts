import { apiFetch } from "./client";

export type SummaryRange = "day" | "week" | "month";

export type TopApp = {
  app: string;
  minutes: number;
  last_used_at: string | null;
  /** data:image/png;base64,... extracted from the app's exe, or null */
  icon: string | null;
};

export type DayBreakdown = { date: string; total_minutes: number };

export type DeviceSummary = {
  device_id: string;
  child_name: string | null;
  child_birth_date: string | null;
  child_photo_url: string | null;
  date: string;
  total_screen_minutes: number;
  top_apps: TopApp[];
  device_status: "online" | "offline";
  last_sync: string | null;
  agent_version: string | null;
  battery_percent: number | null;
  battery_updated_at: string | null;
  breakdown: DayBreakdown[];
  geo_location_label?: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geo_source?: "ip" | "gps" | "";
  geo_updated_at?: string | null;
};

export type InstalledApp = {
  name: string;
  version: string;
  publisher: string;
  install_date: string | null;
  first_seen: string;
  last_seen: string;
  uninstalled_at: string | null;
  icon: string | null;
};

export type Device = {
  id: string;
  child_id: string | null;
  child_name: string;
  platform: "windows" | "android" | "ios";
  status: "unlinked" | "linked";
  created_at: string;
  linked_at: string | null;
  last_sync: string | null;
  agent_version: string | null;
};

export type ActivityHistoryItem = {
  id: string;
  event_type: "app_usage";
  app_name: string;
  app_id: string;
  icon: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
};

export type ActivityHistoryResponse = {
  results: ActivityHistoryItem[];
  count: number;
  limit: number;
  offset: number;
  next_offset: number | null;
};

export type TimelineSegment = {
  app_id: string;
  app_name: string;
  icon: string | null;
  start_minute: number;
  end_minute: number;
  duration_seconds: number;
  active_seconds: number;
  session_count: number;
};

export type TimelineResponse = { date: string; segments: TimelineSegment[] };

export type BrowserUsage = { browser: string; visits: number; minutes?: number };

export type SiteUsage = {
  domain: string;
  minutes: number;
  visits: number;
  last_visited_at: string | null;
  browsers?: BrowserUsage[];
};

export type SitesResponse = {
  device_id: string;
  date: string;
  total_minutes: number;
  total_visits?: number;
  results: SiteUsage[];
  by_browser?: BrowserUsage[];
  count: number;
};

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function getDevices(): Promise<Device[]> {
  return apiFetch("/api/devices/");
}

export function getSummary(
  deviceId: string,
  opts: { date?: string; range?: SummaryRange } = {},
): Promise<DeviceSummary> {
  return apiFetch(`/api/tracking/summary/${deviceId}/${qs(opts)}`);
}

export function getActivityHistory(
  deviceId: string,
  opts: { date?: string; limit?: number; offset?: number } = {},
): Promise<ActivityHistoryResponse> {
  return apiFetch(
    `/api/tracking/history/${deviceId}/${qs({
      date: opts.date,
      limit: opts.limit ?? 50,
      offset: opts.offset ?? 0,
    })}`,
  );
}

export function getActivityTimeline(
  deviceId: string,
  opts: { date?: string } = {},
): Promise<TimelineResponse> {
  return apiFetch(`/api/tracking/timeline/${deviceId}/${qs(opts)}`);
}

/** Browsing per site for ONE device — never pooled across a child's devices. */
export function getSites(
  deviceId: string,
  opts: { date?: string; range?: SummaryRange } = {},
): Promise<SitesResponse> {
  return apiFetch(`/api/tracking/sites/${deviceId}/${qs({ date: opts.date, range: opts.range ?? "day" })}`);
}

export function updateDevice(
  deviceId: string,
  patch: { child_name?: string; child_id?: string | null },
): Promise<Device> {
  return apiFetch(`/api/devices/${deviceId}/`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function unlinkDevice(deviceId: string): Promise<void> {
  await apiFetch(`/api/devices/${deviceId}/`, { method: "DELETE" });
}

export function getInstalledApps(deviceId: string): Promise<InstalledApp[]> {
  return apiFetch(`/api/devices/${deviceId}/installed-apps/`);
}
