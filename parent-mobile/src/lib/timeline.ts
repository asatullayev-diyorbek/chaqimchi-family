// OS-independent half of the day timeline — ported from
// parent-web/src/lib/timeline.ts. Turns the backend's sessions into the few
// blocks the chart draws and sorts apps into a small colour bucket set.

import { colors } from "../theme";
import { AppCategory } from "./appDisplay";
import { TimelineSegment } from "../api/tracking";

export const DISPLAY_GAP_MIN = 15;
export const MAX_BLOCKS_PER_LANE = 6;

export type Bucket = "app" | "work" | "system" | "blocked";
export type Block = { start: number; end: number; sessions: number };

export const BUCKET_META: Record<Bucket, { color: string; label: string }> = {
  app: { color: colors.bucketApp, label: "Ilova / Brauzer" },
  work: { color: colors.bucketWork, label: "Ishchi dastur" },
  system: { color: colors.bucketSystem, label: "Tizim" },
  blocked: { color: colors.bucketBlocked, label: "Bloklangan" },
};

export function bucketOf(appId: string, category: AppCategory): Bucket {
  if (appId.toLowerCase() === "lockapp.exe") return "blocked";
  if (category === "tizim") return "system";
  if (category === "dasturlash" || category === "talim") return "work";
  return "app";
}

export function foldBlocks(parts: TimelineSegment[]): Block[] {
  const sorted = [...parts].sort((a, b) => a.start_minute - b.start_minute);
  let blocks: Block[] = sorted.map((p) => ({
    start: p.start_minute,
    end: p.end_minute,
    sessions: p.session_count || 1,
  }));
  let gap = DISPLAY_GAP_MIN;
  while (blocks.length > 1) {
    const merged: Block[] = [];
    for (const b of blocks) {
      const prev = merged[merged.length - 1];
      if (prev && b.start - prev.end <= gap) {
        prev.end = Math.max(prev.end, b.end);
        prev.sessions += b.sessions;
      } else {
        merged.push({ ...b });
      }
    }
    blocks = merged;
    if (blocks.length <= MAX_BLOCKS_PER_LANE) break;
    gap *= 2;
    if (gap > 1440) break;
  }
  return blocks;
}
