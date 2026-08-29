"use client";

import { useState } from "react";
import { TimelineSegment } from "@/api/tracking";
import { appDisplay } from "@/lib/appDisplay";

// A single-day, 24-hour strip: each app_usage interval is a coloured block
// on a 0..1440 minute axis. Tapping a block shows what it was.
export default function DayTimeline({ segments }: { segments: TimelineSegment[] }) {
  const [active, setActive] = useState<TimelineSegment | null>(null);

  const W = 960;
  const H = 44;
  const px = (min: number) => (min / 1440) * W;

  const totalMin = segments.reduce((s, x) => s + (x.end_minute - x.start_minute), 0);
  const firstMin = segments.length ? segments[0].start_minute : null;
  const lastMin = segments.length ? Math.max(...segments.map((s) => s.end_minute)) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          {segments.length
            ? `${fmtHm(firstMin!)}–${fmtHm(lastMin!)} · jami ${fmtDur(totalMin)}`
            : "Bu kuni faoliyat qayd etilmagan"}
        </span>
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" style={{ minWidth: 640, display: "block" }} role="img" aria-label="Kunlik vaqt jadvali">
          {/* hour grid + labels */}
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <g key={h}>
              <line x1={px(h * 60)} y1={0} x2={px(h * 60)} y2={H} stroke="rgba(37,99,235,.10)" strokeWidth={1} />
              <text x={px(h * 60)} y={H + 15} fontSize={10} fill="#9aa6b6" textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"}>
                {String(h).padStart(2, "0")}:00
              </text>
            </g>
          ))}
          <rect x={0} y={0} width={W} height={H} rx={8} fill="rgba(37,99,235,.04)" />

          {segments.map((seg, i) => {
            const d = appDisplay(seg.app_id, seg.app_name);
            const x = px(seg.start_minute);
            const w = Math.max(px(seg.end_minute) - x, 2);
            const isActive = active === seg;
            return (
              <rect
                key={`${seg.app_id}-${i}`}
                x={x}
                y={4}
                width={w}
                height={H - 8}
                rx={3}
                fill={d.color}
                opacity={active && !isActive ? 0.35 : 0.9}
                style={{ cursor: "pointer" }}
                onClick={() => setActive(isActive ? null : seg)}
              >
                <title>{`${d.label} · ${fmtHm(seg.start_minute)}–${fmtHm(seg.end_minute)} (${fmtDur(Math.round(seg.duration_seconds / 60))})`}</title>
              </rect>
            );
          })}
        </svg>
      </div>

      {active && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "var(--surface, #fff)", border: "1px solid var(--border)" }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: appDisplay(active.app_id, active.app_name).color, flex: "0 0 auto" }} />
          <span style={{ flex: 1, fontWeight: 700 }}>{appDisplay(active.app_id, active.app_name).label}</span>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {fmtHm(active.start_minute)}–{fmtHm(active.end_minute)} · {fmtDur(Math.round(active.duration_seconds / 60))}
          </span>
        </div>
      )}
    </div>
  );
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtDur(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} soat ${m} min` : `${h} soat`;
}
