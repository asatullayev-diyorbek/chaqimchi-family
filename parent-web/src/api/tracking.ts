import { apiFetch } from "./client";

export type TopApp = {
  app: string;
  minutes: number;
};

export type DayBreakdown = {
  date: string;
  total_minutes: number;
};

export type SummaryRange = "day" | "week" | "month";

export type DeviceSummary = {
  device_id: string;
  date: string;
  total_screen_minutes: number;
  top_apps: TopApp[];
  device_status: "online" | "offline";
  last_sync: string | null;
  breakdown: DayBreakdown[];
};

export type Device = {
  id: string;
  child_name: string;
  status: "unlinked" | "linked";
  last_sync: string | null;
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

export async function renameDevice(deviceId: string, childName: string): Promise<Device> {
  return apiFetch(`/api/devices/${deviceId}/`, {
    method: "PATCH",
    body: JSON.stringify({ child_name: childName }),
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

export async function verifyEnrollCode(code: string): Promise<{ device_id: string; status: string }> {
  return apiFetch("/api/enroll/verify-code/", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
