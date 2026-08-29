"use client";

import { ReactNode, useMemo, useState } from "react";
import { TimelineSegment } from "@/api/tracking";
import AppIcon from "@/components/AppIcon";
import { appDisplay, AppCategory } from "@/lib/appDisplay";

const ROW_H = 40;
const TRACK_H = 20;
const LABEL_W = 184;
const AXIS_HOURS = [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
// A same-app run split by less than this is drawn as one block. Bigger than
// the backend's session gap on purpose — the chart wants a readable
// overview, not every session.
const DISPLAY_GAP_MIN = 15;
const MAX_BLOCKS_PER_LANE = 6;

type Bucket = "app" | "work" | "system" | "blocked";

const BUCKET_META: Record<Bucket, { color: string; label: string }> = {
  app: { color: "#2563eb", label: "Ilova / Brauzer" },
  work: { color: "#8b5cf6", label: "Ishchi dastur" },
  system: { color: "#f97316", label: "Tizim faoliyati" },
  blocked: { color: "#94a3b8", label: "Bloklangan" },
};

function bucketOf(appId: string, category: AppCategory): Bucket {
  if (appId.toLowerCase() === "lockapp.exe") return "blocked";
  if (category === "tizim") return "system";
  if (category === "dasturlash" || category === "talim") return "work";
  return "app";
}

type Block = { start: number; end: number; sessions: number };
type Lane = {
  app_id: string;
  app_name: string;
  icon: string | null;
  bucket: Bucket;
  color: string;
  totalMin: number;
  sessions: number;
  blocks: Block[];
};

// Fold a lane's backend segments into at most MAX_BLOCKS_PER_LANE display
// blocks: merge neighbours within DISPLAY_GAP_MIN, then keep widening the
// gap until few enough remain.
function foldBlocks(parts: TimelineSegment[]): Block[] {
  const sorted = [...parts].sort((a, b) => a.start_minute - b.start_minute);
  let blocks: Block[] = sorted.map((p) => ({ start: p.start_minute, end: p.end_minute, sessions: p.session_count || 1 }));

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

export default function DayTimeline({
  segments,
  isToday = false,
  dateISO,
  dateTitle,
  dateSubtitle,
  nav,
}: {
  segments: TimelineSegment[];
  isToday?: boolean;
  dateISO: string;
  dateTitle: string;
  dateSubtitle: string;
  nav: ReactNode;
}) {
  const [activeOnly, setActiveOnly] = useState(false);
  const [hover, setHover] = useState<{ lane: number; block: number } | null>(null);

  const allLanes = useMemo<Lane[]>(() => {
    const byApp = new Map<string, TimelineSegment[]>();
    for (const s of segments) {
      const arr = byApp.get(s.app_id) ?? [];
      arr.push(s);
      byApp.set(s.app_id, arr);
    }
    return [...byApp.entries()]
      .map(([app_id, parts]) => {
        const d = appDisplay(app_id, parts[0].app_name);
        const bucket = bucketOf(app_id, d.category);
        const blocks = foldBlocks(parts);
        return {
          app_id,
          app_name: parts[0].app_name,
          icon: parts.find((p) => p.icon)?.icon ?? null,
          bucket,
          color: BUCKET_META[bucket].color,
          totalMin: parts.reduce((t, p) => t + (p.end_minute - p.start_minute), 0),
          sessions: parts.reduce((t, p) => t + (p.session_count || 1), 0),
          blocks,
        };
      })
      .sort((a, b) => b.totalMin - a.totalMin);
  }, [segments]);

  const lanes = (activeOnly ? allLanes.filter((l) => l.bucket === "app" || l.bucket === "work") : allLanes).slice(0, 10);

  const stats = useMemo(() => {
    const total = segments.reduce((t, s) => t + (s.end_minute - s.start_minute), 0);
    const blocked = allLanes.filter((l) => l.bucket === "blocked").reduce((t, l) => t + l.totalMin, 0);
    const activeApps = allLanes.filter((l) => l.bucket === "app" || l.bucket === "work").length;
    const sessions = segments.reduce((t, s) => t + (s.session_count || 1), 0);
    const first = segments.length ? Math.min(...segments.map((s) => s.start_minute)) : null;
    const last = segments.length ? Math.max(...segments.map((s) => s.end_minute)) : null;
    return { total, blocked, activeApps, sessions, first, last };
  }, [segments, allLanes]);

  const nowMin = isToday && dateISO === todayISO() ? new Date().getHours() * 60 + new Date().getMinutes() : null;
  const pct = (min: number) => `${(min / 1440) * 100}%`;
  const usedBuckets = new Set(allLanes.map((l) => l.bucket));

  return (
    <div>
      {/* header: date + mini stats + nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 12, background: "var(--cat-blue-bg, #e6edfc)", color: "var(--brand-blue, #2563eb)", flex: "0 0 auto" }}>
            <iconify-icon icon="solar:calendar-linear" style={{ fontSize: 20 }}></iconify-icon>
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{dateTitle}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{dateSubtitle}</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>{nav}</div>
      </div>

      {segments.length > 0 && (
        <div className="mini-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(128px,1fr))", marginBottom: 16 }}>
          <MiniStat icon="solar:clock-circle-linear" label="Jami faoliyat vaqti" value={fmtDur(stats.total)} />
          <MiniStat icon="solar:widget-2-linear" label="Faol ilovalar" value={`${stats.activeApps} ta`} />
          <MiniStat icon="solar:pulse-linear" label="Sessionlar" value={`${stats.sessions} ta`} />
          <MiniStat icon="solar:lock-keyhole-linear" label="Bloklangan vaqt" value={stats.blocked ? fmtDur(stats.blocked) : "—"} />
        </div>
      )}

      {segments.length === 0 ? (
        <div style={{ padding: "40px 16px", textAlign: "center" }}>
          <div style={{ width: 46, height: 46, margin: "0 auto 12px", display: "grid", placeItems: "center", borderRadius: 14, background: "var(--cat-blue-bg, #e6edfc)", color: "var(--brand-blue, #2563eb)" }}>
            <iconify-icon icon="solar:calendar-linear" style={{ fontSize: 22 }}></iconify-icon>
          </div>
          <strong style={{ display: "block", fontSize: 15 }}>Bu kuni faoliyat qayd etilmagan</strong>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>Qurilma o&apos;chirilgan yoki sinxronlanmagan bo&apos;lishi mumkin.</p>
        </div>
      ) : (
        <>
          {/* toggle + legend */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ display: "inline-flex", padding: 3, borderRadius: 10, background: "rgba(37,99,235,.06)" }}>
              {([["all", "Barcha vaqt"], ["active", "Faqat faol vaqt"]] as const).map(([k, label]) => {
                const on = (k === "active") === activeOnly;
                return (
                  <button
                    key={k}
                    onClick={() => setActiveOnly(k === "active")}
                    style={{
                      border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700,
                      padding: "6px 12px", borderRadius: 8,
                      background: on ? "var(--surface, #fff)" : "transparent",
                      color: on ? "var(--brand-blue, #2563eb)" : "var(--muted)",
                      boxShadow: on ? "0 1px 3px rgba(37,99,235,.15)" : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--muted)" }}>
              {(Object.keys(BUCKET_META) as Bucket[]).filter((b) => usedBuckets.has(b)).map((b) => (
                <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: BUCKET_META[b].color }} />
                  {BUCKET_META[b].label}
                </span>
              ))}
            </div>
          </div>

          {/* timeline */}
          <div style={{ display: "flex" }}>
            <div style={{ width: LABEL_W, flex: `0 0 ${LABEL_W}px` }}>
              <div style={{ height: 22 }} />
              {lanes.map((lane) => {
                const d = appDisplay(lane.app_id, lane.app_name);
                return (
                  <div key={lane.app_id} style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 9, paddingRight: 12, minWidth: 0 }}>
                    <AppIcon appId={lane.app_id} appName={lane.app_name} icon={lane.icon} size={26} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtDur(lane.totalMin)}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              {/* hour axis */}
              <div style={{ position: "relative", height: 22 }}>
                {AXIS_HOURS.map((h) => (
                  <span key={h} style={{ position: "absolute", left: pct(h * 60), top: 4, fontSize: 10, color: "#9aa6b6", transform: h === 0 ? "none" : h === 24 ? "translateX(-100%)" : "translateX(-50%)" }}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>

              {/* guide lines + now marker span the lanes area */}
              <div style={{ position: "absolute", left: 0, right: 0, top: 22, height: lanes.length * ROW_H, pointerEvents: "none" }}>
                {AXIS_HOURS.map((h) => (
                  <div key={h} style={{ position: "absolute", left: pct(h * 60), top: 0, bottom: 0, width: 1, background: "rgba(37,99,235,.07)" }} />
                ))}
                {nowMin !== null && (
                  <div style={{ position: "absolute", left: pct(nowMin), top: -6, bottom: -6, width: 2, borderRadius: 2, background: "var(--brand-blue, #2563eb)" }} />
                )}
              </div>

              {/* lanes */}
              {lanes.map((lane, laneIdx) => (
                <div key={lane.app_id} style={{ position: "relative", height: ROW_H }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: (ROW_H - TRACK_H) / 2, height: TRACK_H, borderRadius: 7, background: "rgba(37,99,235,.04)" }} />
                  {lane.blocks.map((b, blockIdx) => {
                    const w = ((b.end - b.start) / 1440) * 100;
                    const tiny = b.end - b.start < 6;
                    const wide = w > 7;
                    const isHover = hover?.lane === laneIdx && hover?.block === blockIdx;
                    return (
                      <div
                        key={blockIdx}
                        onMouseEnter={() => setHover({ lane: laneIdx, block: blockIdx })}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          position: "absolute",
                          left: pct(b.start),
                          width: tiny ? 4 : `${w}%`,
                          top: (ROW_H - TRACK_H) / 2,
                          height: TRACK_H,
                          borderRadius: tiny ? 2 : 7,
                          background: lane.color,
                          opacity: hover && !isHover ? 0.35 : 1,
                          boxShadow: isHover ? "0 3px 10px rgba(37,99,235,.3)" : "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          transition: "opacity .12s",
                        }}
                      >
                        {wide && !tiny && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", padding: "0 6px" }}>
                            {fmtHm(b.start)} – {fmtHm(b.end)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* tooltip */}
              {hover && lanes[hover.lane]?.blocks[hover.block] && (() => {
                const lane = lanes[hover.lane];
                const b = lane.blocks[hover.block];
                const d = appDisplay(lane.app_id, lane.app_name);
                return (
                  <div
                    style={{
                      position: "absolute",
                      left: pct((b.start + b.end) / 2),
                      top: 22 + hover.lane * ROW_H - 6,
                      transform: "translate(-50%, -100%)",
                      zIndex: 6,
                      pointerEvents: "none",
                      background: "var(--foreground, #1f2b3a)",
                      color: "#fff",
                      padding: "8px 11px",
                      borderRadius: 10,
                      fontSize: 12,
                      lineHeight: 1.55,
                      whiteSpace: "nowrap",
                      boxShadow: "0 10px 28px rgba(0,0,0,.2)",
                    }}
                  >
                    <strong>{d.label}</strong>
                    <br />
                    {fmtHm(b.start)} – {fmtHm(b.end)}
                    <br />
                    <span style={{ opacity: 0.8 }}>Davomiyligi: {fmtDur(b.end - b.start)}</span>
                    {b.sessions > 1 && <><br /><span style={{ opacity: 0.8 }}>Sessionlar: {b.sessions} ta</span></>}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="mini-stat">
      <iconify-icon icon={icon}></iconify-icon>
      <span>{label}</span>
      <h4>{value}</h4>
    </div>
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtDur(min: number): string {
  min = Math.round(min);
  if (min < 1) return "1 daqiqadan kam";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} soat ${m} min` : `${h} soat`;
}
