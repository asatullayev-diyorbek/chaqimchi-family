// On-demand screenshot capture (see agent/internal/screenshot + server/apps/screenshots).
//
// The parent queues a request; the agent's next poll picks it up, captures
// the child's screen and uploads it to Cloudflare R2. The parent app polls
// `listScreenshots` until the row flips to "uploaded" and a signed image URL
// appears. Nothing is captured without the child being shown it happened.

import { apiFetch } from "./client";

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
  /** Short-lived signed R2 URL — present only for a viewable "uploaded" row. */
  url: string | null;
};

export const RETENTION_LABEL: Record<ScreenshotRetention, string> = {
  day: "1 kun",
  week: "1 hafta",
  month: "1 oy",
};

export type ScreenshotRequestResult = Screenshot & { device_online: boolean };

/** Queue a capture. 429 if the hourly limit is hit, 400 if the device is
 *  unlinked, 503 if screenshot storage isn't configured on the server. */
export function requestScreenshot(
  deviceId: string,
  retention: ScreenshotRetention,
): Promise<ScreenshotRequestResult> {
  return apiFetch("/api/screenshots/request/", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId, retention }),
  });
}

export async function listScreenshots(deviceId: string): Promise<Screenshot[]> {
  const res = await apiFetch<{ results: Screenshot[] }>(
    `/api/screenshots/?device_id=${encodeURIComponent(deviceId)}`,
  );
  return res.results ?? [];
}

export async function deleteScreenshot(id: string): Promise<void> {
  await apiFetch(`/api/screenshots/${id}/`, { method: "DELETE" });
}

/** A request still working its way through the pipeline. */
export function isPending(s: Screenshot): boolean {
  return s.status === "pending" || s.status === "capturing";
}
