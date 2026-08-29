import { describe, expect, it } from "vitest";
import { TimelineSegment } from "@/api/tracking";
import { bucketOf, foldBlocks, MAX_BLOCKS_PER_LANE } from "./timeline";

function seg(start: number, end: number, sessions = 1): TimelineSegment {
  return {
    app_id: "chrome.exe",
    app_name: "Google Chrome",
    icon: null,
    start_minute: start,
    end_minute: end,
    duration_seconds: (end - start) * 60,
    active_seconds: (end - start) * 60,
    session_count: sessions,
  };
}

describe("foldBlocks", () => {
  it("leaves a single session alone", () => {
    expect(foldBlocks([seg(540, 600)])).toEqual([{ start: 540, end: 600, sessions: 1 }]);
  });

  it("merges sessions separated by a short gap", () => {
    // 10-minute gap, under the 15-minute display threshold.
    const blocks = foldBlocks([seg(540, 560), seg(570, 600)]);
    expect(blocks).toEqual([{ start: 540, end: 600, sessions: 2 }]);
  });

  it("keeps sessions separated by a long gap apart", () => {
    const blocks = foldBlocks([seg(540, 560), seg(700, 720)]);
    expect(blocks).toHaveLength(2);
  });

  it("never returns more than MAX_BLOCKS_PER_LANE", () => {
    // 40 slivers 20 minutes apart — above the initial gap, so the fold has to
    // widen the gap repeatedly. This is the shape a real Chrome day arrives in.
    const many = Array.from({ length: 40 }, (_, i) => seg(i * 20, i * 20 + 5));
    expect(foldBlocks(many).length).toBeLessThanOrEqual(MAX_BLOCKS_PER_LANE);
  });

  it("preserves the day's true span and session count while folding", () => {
    const many = Array.from({ length: 40 }, (_, i) => seg(i * 20, i * 20 + 5));
    const blocks = foldBlocks(many);
    expect(blocks[0].start).toBe(0);
    expect(blocks[blocks.length - 1].end).toBe(39 * 20 + 5);
    expect(blocks.reduce((t, b) => t + b.sessions, 0)).toBe(40);
  });

  it("sorts out-of-order input before folding", () => {
    const blocks = foldBlocks([seg(700, 720), seg(540, 560)]);
    expect(blocks[0].start).toBe(540);
  });

  it("does not mutate the caller's array", () => {
    const input = [seg(540, 560), seg(570, 600)];
    const snapshot = JSON.parse(JSON.stringify(input));
    foldBlocks(input);
    expect(input).toEqual(snapshot);
  });

  it("handles an empty day", () => {
    expect(foldBlocks([])).toEqual([]);
  });
});

describe("bucketOf", () => {
  it("treats the lock screen as blocked time, not as system usage", () => {
    expect(bucketOf("LockApp.exe", "tizim")).toBe("blocked");
    expect(bucketOf("lockapp.exe", "tizim")).toBe("blocked");
  });

  it("separates work apps from leisure ones", () => {
    expect(bucketOf("code.exe", "dasturlash")).toBe("work");
    expect(bucketOf("winword.exe", "talim")).toBe("work");
    expect(bucketOf("chrome.exe", "brauzer")).toBe("app");
    expect(bucketOf("steam.exe", "oyin")).toBe("app");
  });

  it("buckets the rest of the OS as system", () => {
    expect(bucketOf("explorer.exe", "tizim")).toBe("system");
  });
});
