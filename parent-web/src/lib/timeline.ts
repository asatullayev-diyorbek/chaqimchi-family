import { TimelineSegment } from "@/api/tracking";
import { AppCategory } from "@/lib/appDisplay";

// The OS-independent half of the day timeline: turning the backend's sessions
// into the handful of blocks the chart draws, and sorting apps into the small
// set of colour buckets. Kept out of the component so it can be tested without
// rendering anything.

/** A same-app run split by less than this is drawn as one block. */
export const DISPLAY_GAP_MIN = 15;
export const MAX_BLOCKS_PER_LANE = 6;

export type Bucket = "app" | "work" | "system" | "blocked";
export type Block = { start: number; end: number; sessions: number };

export const BUCKET_META: Record<Bucket, { color: string; label: string }> = {
  app: { color: "var(--bucket-app)", label: "Ilova / Brauzer" },
  work: { color: "var(--bucket-work)", label: "Ishchi dastur" },
  system: { color: "var(--bucket-system)", label: "Tizim faoliyati" },
  blocked: { color: "var(--bucket-blocked)", label: "Bloklangan" },
};

export function bucketOf(appId: string, category: AppCategory): Bucket {
  if (appId.toLowerCase() === "lockapp.exe") return "blocked";
  if (category === "tizim") return "system";
  if (category === "dasturlash" || category === "talim") return "work";
  return "app";
}

/**
 * Fold one app's sessions into at most MAX_BLOCKS_PER_LANE display blocks:
 * merge neighbours within DISPLAY_GAP_MIN, then keep doubling the gap until
 * few enough remain. The chart wants a readable overview of the day, not one
 * sliver per session — a busy Chrome day can arrive as 40+ segments.
 */
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
