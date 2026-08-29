"use client";

import { useMemo, useState } from "react";
import { TimelineSegment } from "@/api/tracking";
import AppIcon from "@/components/AppIcon";
import { appDisplay, AppCategory } from "@/lib/appDisplay";

const ROW_H = 38;
const TRACK_H = 18;
const LABEL_W = 176;
const AXIS_HOURS = [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

// The dashboard is a calm blue system — collapse the per-app categories into
// three muted buckets rather than a rainbow.
function bucketColor(category: AppCategory): string {
  if (category === "brauzer") return "#2563eb"; // browser / web — primary blue
  if (category === "tizim") return "#94a3b8"; // system — neutral slate
  return "#6366f1"; // everything else — a quiet indigo for "an app"
}

type Lane = {
  app_id: string;
  app_name: string;
  icon: string | null;
  color: string;
  totalMin: number;
  sessions: number;
  parts: TimelineSegment[];
};

export default function DayTimeline({ segments, isToday = false }: { segments: TimelineSegment[]; isToday?: boolean }) {
  const [hover, setHover] = useState<{ laneIdx: number; partIdx: number } | null>(null);

  const lanes = useMemo<Lane[]>(() => {
    const byApp = new Map<string, Lane>();
    for (const s of segments) {
      const d = appDisplay(s.app_id, s.app_name);
      const l = byApp.get(s.app_id) ?? {
        app_id: s.app_id, app_name: s.app_name, icon: s.icon,
        color: bucketColor(d.category), totalMin: 0, sessions: 0, parts: [],
      };
      l.totalMin += s.end_minute - s.start_minute;
      l.sessions += s.session_count || 1;
      l.parts.push(s);
      if (s.icon) l.icon = s.icon;
      byApp.set(s.app_id, l);
    }
    return [...byApp.values()].sort((a, b) => b.totalMin - a.totalMin).slice(0, 10);
  }, [segments]);

  if (!segments.length) {
    return (
      <div style={{ padding: "36px 16px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, margin: "0 auto 12px", display: "grid", placeItems: "center", borderRadius: 14, background: "var(--cat-blue-bg, #e6edfc)", color: "var(--brand-blue, #2563eb)" }}>
          <iconify-icon icon="solar:calendar-linear" style={{ fontSize: 22 }}></iconify-icon>
        </div>
        <strong style={{ display: "block", fontSize: 15 }}>Bu kuni faoliyat qayd etilmagan</strong>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>Qurilma o&apos;chirilgan yoki sinxronlanmagan bo&apos;lishi mumkin.</p>
      </div>
    );
  }

  const totalMin = segments.reduce((s, x) => s + (x.end_minute - x.start_minute), 0);
  const first = Math.min(...segments.map((s) => s.start_minute));
  const last = Math.max(...segments.map((s) => s.end_minute));
  const totalSessions = segments.reduce((s, x) => s + (x.session_count || 1), 0);
  const nowMin = isToday ? Math.min(1440, new Date().getHours() * 60 + new Date().getMinutes()) : null;

  const pct = (min: number) => `${(min / 1440) * 100}%`;
  const hovered = hover ? lanes[hover.laneIdx]?.parts[hover.partIdx] : null;

  return (
    <div>
      {/* summary */}
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>
        {fmtHm(first)}–{fmtHm(last)} orasida, jami <strong style={{ color: "var(--foreground)" }}>{fmtDur(totalMin)}</strong>
      </p>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px" }}>
        {totalSessions} ta session · {lanes.length} ta ilova
      </p>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 640, display: "flex" }}>
          {/* left: app labels */}
          <div style={{ width: LABEL_W, flex: `0 0 ${LABEL_W}px` }}>
            {lanes.map((lane) => {
              const d = appDisplay(lane.app_id, lane.app_name);
              return (
                <div key={lane.app_id} style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 8, paddingRight: 12, minWidth: 0 }}>
                  <AppIcon appId={lane.app_id} appName={lane.app_name} icon={lane.icon} size={22} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDur(lane.totalMin)}</span>
                  </span>
                </div>
              );
            })}
            <div style={{ height: 16 }} />
          </div>

          {/* right: shared 24h track area */}
          <div style={{ position: "relative", flex: 1 }}>
            {/* hour guides */}
            {AXIS_HOURS.map((h) => (
              <div key={h} style={{ position: "absolute", left: pct(h * 60), top: 0, bottom: 16, width: 1, background: "rgba(37,99,235,.08)" }} />
            ))}

            {/* now marker */}
            {nowMin !== null && (
              <div style={{ position: "absolute", left: pct(nowMin), top: -2, bottom: 16, width: 2, background: "var(--brand-blue, #2563eb)", zIndex: 3 }}>
                <span style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, color: "var(--brand-blue, #2563eb)", background: "var(--surface, #fff)", padding: "0 4px", borderRadius: 4, whiteSpace: "nowrap" }}>HOZIR</span>
              </div>
            )}

            {/* lanes */}
            {lanes.map((lane, laneIdx) => (
              <div key={lane.app_id} style={{ position: "relative", height: ROW_H }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: (ROW_H - TRACK_H) / 2, height: TRACK_H, borderRadius: 6, background: "rgba(37,99,235,.045)" }} />
                {lane.parts.map((p, partIdx) => {
                  const isHover = hover?.laneIdx === laneIdx && hover?.partIdx === partIdx;
                  return (
                    <div
                      key={partIdx}
                      onMouseEnter={() => setHover({ laneIdx, partIdx })}
                      onMouseLeave={() => setHover(null)}
                      style={{
                        position: "absolute",
                        left: pct(p.start_minute),
                        width: `max(4px, ${((p.end_minute - p.start_minute) / 1440) * 100}%)`,
                        top: (ROW_H - TRACK_H) / 2,
                        height: TRACK_H,
                        borderRadius: 5,
                        background: lane.color,
                        opacity: hover && !isHover ? 0.4 : 1,
                        boxShadow: isHover ? "0 2px 8px rgba(37,99,235,.35)" : "none",
                        transition: "opacity .12s",
                        cursor: "default",
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {/* axis labels */}
            <div style={{ position: "relative", height: 16 }}>
              {AXIS_HOURS.map((h) => (
                <span key={h} style={{ position: "absolute", left: pct(h * 60), top: 2, fontSize: 10, color: "#9aa6b6", transform: h === 0 ? "none" : h === 24 ? "translateX(-100%)" : "translateX(-50%)" }}>
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            {/* tooltip */}
            {hovered && hover && (
              <div
                style={{
                  position: "absolute",
                  left: pct((hovered.start_minute + hovered.end_minute) / 2),
                  top: hover.laneIdx * ROW_H - 8,
                  transform: `translate(-50%, -100%)`,
                  zIndex: 5,
                  pointerEvents: "none",
                  background: "var(--foreground, #1f2b3a)",
                  color: "#fff",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: "nowrap",
                  boxShadow: "0 8px 24px rgba(0,0,0,.18)",
                }}
              >
                <strong style={{ fontSize: 12.5 }}>{appDisplay(hovered.app_id, hovered.app_name).label}</strong>
                <br />
                {fmtHm(hovered.start_minute)} — {fmtHm(hovered.end_minute)}
                <br />
                <span style={{ opacity: 0.8 }}>Davomiyligi: {fmtDur(hovered.end_minute - hovered.start_minute)}</span>
                {hovered.session_count > 1 && (
                  <>
                    <br />
                    <span style={{ opacity: 0.8 }}>Sessionlar: {hovered.session_count} ta</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
