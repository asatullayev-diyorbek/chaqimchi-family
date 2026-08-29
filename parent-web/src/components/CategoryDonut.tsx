"use client";

import { useEffect, useRef, useState } from "react";

export type DonutSlice = { label: string; minutes: number; color: string; percent: number };

const C = 326.73; // circumference of r=52

// The overview "Faoliyat kategoriyalari" ring. Hovering a slice (or its
// legend row) lifts it, dims the rest, and shows a tooltip that follows the
// pointer. Pure presentational — the caller supplies real aggregated slices.
export default function CategoryDonut({ slices, totalMinutes }: { slices: DonutSlice[]; totalMinutes: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [inChart, setInChart] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current); }, []);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pending.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (raf.current == null) {
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        if (pending.current) setPos(pending.current);
      });
    }
  };

  const arcs = slices.map((s, i) => {
    const len = (C * s.percent) / 100;
    const offset = -slices.slice(0, i).reduce((sum, p) => sum + (C * p.percent) / 100, 0);
    return { ...s, len, offset, i };
  });

  return (
    <div className="activity-layout">
      <div
        className="chart"
        style={{ width: 150, height: 150 }}
        onMouseMove={(e) => { setInChart(true); onMove(e); }}
        onMouseLeave={() => { setInChart(false); setHover(null); }}
      >
        <svg viewBox="0 0 120 120" width="150" height="150">
          <g transform="rotate(-90 60 60)" fill="none">
            <circle cx="60" cy="60" r="52" stroke="rgba(37,99,235,.06)" strokeWidth="16" />
            {arcs.map((a) => {
              const on = hover === a.i;
              return (
                <circle
                  key={a.label}
                  cx="60"
                  cy="60"
                  r="52"
                  stroke={a.color}
                  strokeWidth={on ? 19 : 16}
                  strokeDasharray={`${Math.max(a.len - 1.5, 0)} ${C - a.len + 1.5}`}
                  strokeDashoffset={a.offset}
                  strokeLinecap="round"
                  opacity={hover !== null && !on ? 0.4 : 1}
                  style={{ transition: "stroke-width .12s, opacity .12s", cursor: "pointer" }}
                  onMouseEnter={() => setHover(a.i)}
                />
              );
            })}
          </g>
        </svg>

        <div className="chart-total">
          <strong style={{ fontSize: 16 }}>{fmtDur(totalMinutes)}</strong>
          <span>Jami</span>
        </div>

        {hover !== null && inChart && slices[hover] && (
          <div
            style={{
              position: "absolute",
              left: pos.x + 14,
              top: pos.y - 14,
              transform: "translateY(-100%)",
              zIndex: 6,
              pointerEvents: "none",
              background: "var(--foreground, #1f2b3a)",
              color: "#fff",
              padding: "9px 12px",
              borderRadius: 10,
              fontSize: 12.5,
              lineHeight: 1.55,
              whiteSpace: "nowrap",
              boxShadow: "0 10px 28px rgba(0,0,0,.22)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: slices[hover].color }} />
              {slices[hover].label}
            </span>
            <span style={{ display: "block", fontWeight: 700, color: "#93b4ff" }}>
              {fmtDur(slices[hover].minutes)} ({slices[hover].percent}%)
            </span>
          </div>
        )}
      </div>

      <ul>
        {slices.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default", opacity: hover !== null && hover !== i ? 0.5 : 1, transition: "opacity .12s" }}
          >
            <span>
              <i style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, marginRight: 9, flexShrink: 0 }} />
              {s.label}
            </span>
            <em>{fmtDur(s.minutes)}</em>
            <strong>{s.percent}%</strong>
          </li>
        ))}
        {!slices.length && <li><span>Bugun faoliyat ma&apos;lumoti yo&apos;q.</span></li>}
      </ul>
    </div>
  );
}

function fmtDur(min: number): string {
  min = Math.round(min);
  if (min < 1) return "0 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} soat ${m} min` : `${h} soat`;
}
