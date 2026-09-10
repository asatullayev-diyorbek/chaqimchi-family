import { apiFetch } from "./client";

// On-demand screenshot capture. Mirrors parent-mobile/src/api/screenshots.ts
// and the server's apps/screenshots endpoints. A parent queues a request;
// the agent captures the child's screen on its next poll and uploads it to
// Cloudflare R2; this app polls `listScreenshots` until the row is
// "uploaded" and a signed URL appears.

export type ScreenshotRetention = "day" | "week" | "month";

export type ScreenshotStatus =
  | "pending"
  | "capturing"
  | "uploaded"
  | "failed"
  | "expired";

export type Screenshot = {
  id: string;
  device: string;
  status: ScreenshotStatus;
  retention: ScreenshotRetention;
  created_at: string;
  captured_at: string | null;
  expires_at: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  error: string;
  url: string | null;
};

export const RETENTION_LABEL: Record<ScreenshotRetention, string> = {
  day: "1 kun",
  week: "1 hafta",
  month: "1 oy",
};

export function requestScreenshot(
  deviceId: string,
  retention: ScreenshotRetention,
): Promise<Screenshot & { device_online: boolean }> {
  return apiFetch("/api/screenshots/request/", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId, retention }),
  });
}

export async function listScreenshots(deviceId: string): Promise<Screenshot[]> {
  const res = await apiFetch(
    `/api/screenshots/?device_id=${encodeURIComponent(deviceId)}`,
    { noCache: true },
  );
  return res?.results ?? [];
}

export async function deleteScreenshot(id: string): Promise<void> {
  await apiFetch(`/api/screenshots/${id}/`, { method: "DELETE" });
}

export function isPending(s: Screenshot): boolean {
  return s.status === "pending" || s.status === "capturing";
}
