import { apiFetch } from "./client";

export type TopApp = {
  app: string;
  minutes: number;
  last_used_at: string | null;
  /** data:image/png;base64,... extracted from the app's exe, or null */
  icon: string | null;
};

export type DayBreakdown = {
  date: string;
  total_minutes: number;
};

export type SummaryRange = "day" | "week" | "month";

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

export type TimelineSegment = {
  app_id: string;
  app_name: string;
  icon: string | null;
  start_minute: number;
  end_minute: number;
  duration_seconds: number;
};

export type TimelineResponse = {
  date: string;
  segments: TimelineSegment[];
};

export async function getActivityTimeline(
  deviceId: string,
  options: { date?: string } = {},
): Promise<TimelineResponse> {
  const q = options.date ? `?date=${options.date}` : "";
  return apiFetch(`/api/tracking/timeline/${deviceId}/${q}`);
}

export type ActivityHistoryResponse = {
  results: ActivityHistoryItem[];
  count: number;
  limit: number;
  offset: number;
  next_offset: number | null;
};

export async function getDevices(): Promise<Device[]> {
  return apiFetch("/api/devices/");
}

export async function getSummary(
  deviceId: string,
  options: { date?: string; range?: SummaryRange } = {}
): Promise<DeviceSummary> {
  const params = new URLSearchParams();
  if (options.date) params.set("date", options.date);
  if (options.range) params.set("range", options.range);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/api/tracking/summary/${deviceId}/${query}`);
}

export async function getActivityHistory(
  deviceId: string,
  options: { date?: string; limit?: number; offset?: number } = {},
): Promise<ActivityHistoryResponse> {
  const params = new URLSearchParams();
  if (options.date) params.set("date", options.date);
  params.set("limit", String(options.limit ?? 50));
  params.set("offset", String(options.offset ?? 0));
  return apiFetch(`/api/tracking/history/${deviceId}/?${params.toString()}`);
}

export async function updateDevice(
  deviceId: string,
  patch: { child_name?: string; child_id?: string | null },
): Promise<Device> {
  return apiFetch(`/api/devices/${deviceId}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function unlinkDevice(deviceId: string): Promise<void> {
  await apiFetch(`/api/devices/${deviceId}/`, { method: "DELETE" });
}

export async function generateEnrollCode(
  deviceHint?: string
): Promise<{ device_id: string; code: string; qr_payload: string; expires_at: string }> {
  return apiFetch("/api/enroll/generate-code/", {
    method: "POST",
    body: JSON.stringify({ device_hint: deviceHint ?? "" }),
  });
}

export async function verifyEnrollCode(code: string, childId?: string): Promise<{ device_id: string; status: string }> {
  return apiFetch("/api/enroll/verify-code/", {
    method: "POST",
    body: JSON.stringify({ code, child_id: childId }),
  });
}
