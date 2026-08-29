"use client";

import { useMemo, useState } from "react";
import { TimelineSegment } from "@/api/tracking";
import AppIcon from "@/components/AppIcon";
import { appDisplay } from "@/lib/appDisplay";

// One lane per app: its name + total on the left, its usage blocks placed
// along a shared 24-hour track on the right. Reads directly as
// "Chrome — 09:00-10:00, 14:00-15:00".
export default function DayTimeline({ segments }: { segments: TimelineSegment[] }) {
  const [active, setActive] = useState<string | null>(null);

  const lanes = useMemo(() => {
    const byApp = new Map<string, { app_id: string; app_name: string; icon: string | null; total: number; parts: TimelineSegment[] }>();
    for (const s of segments) {
      const l = byApp.get(s.app_id) ?? { app_id: s.app_id, app_name: s.app_name, icon: s.icon, total: 0, parts: [] };
      l.total += s.end_minute - s.start_minute;
      l.parts.push(s);
      if (s.icon) l.icon = s.icon;
      byApp.set(s.app_id, l);
    }
    return [...byApp.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [segments]);

  if (!segments.length) {
    return <p style={{ color: "var(--muted)", fontSize: 14, margin: "8px 0" }}>Bu kuni faoliyat qayd etilmagan.</p>;
  }

  const HOURS = [0, 6, 12, 18, 24];
  const totalMin = segments.reduce((s, x) => s + (x.end_minute - x.start_minute), 0);
  const first = Math.min(...segments.map((s) => s.start_minute));
  const last = Math.max(...segments.map((s) => s.end_minute));

  return (
    <div style={{ overflowX: "auto" }}>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>
        {fmtHm(first)}–{fmtHm(last)} orasida, jami <strong style={{ color: "var(--foreground)" }}>{fmtDur(totalMin)}</strong>
      </p>
      <div style={{ minWidth: 560 }}>
        {lanes.map((lane) => {
          const d = appDisplay(lane.app_id, lane.app_name);
          return (
            <div key={lane.app_id} style={{ display: "grid", gridTemplateColumns: "168px 1fr", alignItems: "center", gap: 12, padding: "7px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <AppIcon appId={lane.app_id} appName={lane.app_name} icon={lane.icon} size={24} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtDur(lane.total)}</span>
                </span>
              </div>
              <div
                style={{
                  position: "relative",
                  height: 20,
                  borderRadius: 6,
                  background: "rgba(37,99,235,.05)",
                  backgroundImage: "repeating-linear-gradient(to right, transparent 0, transparent calc(25% - 1px), rgba(37,99,235,.10) calc(25% - 1px), rgba(37,99,235,.10) 25%)",
                }}
              >
                {lane.parts.map((p, i) => {
                  const key = `${lane.app_id}-${i}`;
                  return (
                    <button
                      key={key}
                      title={`${d.label} · ${fmtHm(p.start_minute)}–${fmtHm(p.end_minute)} (${fmtDur(p.end_minute - p.start_minute)})`}
                      onClick={() => setActive(active === key ? null : key)}
                      style={{
                        position: "absolute",
                        left: `${(p.start_minute / 1440) * 100}%`,
                        width: `max(3px, ${((p.end_minute - p.start_minute) / 1440) * 100}%)`,
                        top: 2,
                        bottom: 2,
                        border: "none",
                        padding: 0,
                        borderRadius: 4,
                        background: d.color,
                        opacity: active && active !== key ? 0.4 : 1,
                        cursor: "pointer",
                      }}
                    />
                  );
                })}
                {lane.parts.map((p, i) => {
                  const key = `${lane.app_id}-${i}`;
                  if (active !== key) return null;
                  return (
                    <span
                      key={`lbl-${key}`}
                      style={{
                        position: "absolute",
                        left: `${(p.start_minute / 1440) * 100}%`,
                        top: -20,
                        fontSize: 11,
                        fontWeight: 700,
                        color: d.color,
                        whiteSpace: "nowrap",
                        transform: p.start_minute > 1080 ? "translateX(-100%)" : undefined,
                      }}
                    >
                      {fmtHm(p.start_minute)}–{fmtHm(p.end_minute)}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* shared hour axis */}
        <div style={{ display: "grid", gridTemplateColumns: "168px 1fr", gap: 12, marginTop: 4 }}>
          <span />
          <div style={{ position: "relative", height: 14 }}>
            {HOURS.map((h) => (
              <span
                key={h}
                style={{
                  position: "absolute",
                  left: `${(h / 24) * 100}%`,
                  fontSize: 10,
                  color: "#9aa6b6",
                  transform: h === 0 ? "none" : h === 24 ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
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
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} soat ${m} min` : `${h} soat`;
}
