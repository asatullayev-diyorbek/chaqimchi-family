"use client";

import { useEffect, useRef, useState } from "react";

// Static SVG charts styled to match the parent-web dashboard (same viewBox,
// grid, axis and bar tokens). Sample data — a representative marketing
// preview. Both animate in the first time they scroll into view.

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- defensive fallback for environments without IO
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

const WEEK = [
  { d: "Du", h: 2.1 },
  { d: "Se", h: 3.4 },
  { d: "Ch", h: 2.8 },
  { d: "Pa", h: 3.9 },
  { d: "Ju", h: 3.1 },
  { d: "Sh", h: 4.6 },
  { d: "Ya", h: 4.0 },
];

export function WeekBars() {
  const { ref, seen } = useInView<SVGSVGElement>();
  const maxH = 5;
  const x0 = 40;
  const x1 = 540;
  const top = 10;
  const bottom = 154;
  const band = (x1 - x0) / WEEK.length;
  const barW = 26;
  const peak = Math.max(...WEEK.map((v) => v.h));

  return (
    <svg
      ref={ref}
      className="graph"
      viewBox="0 0 560 190"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="7 kunlik ekran vaqti — namunaviy grafik"
    >
      <g stroke="var(--chart-grid)" strokeWidth="1">
        {[10, 46, 82, 118, 154].map((y) => (
          <line key={y} x1={x0} y1={y} x2={x1} y2={y} />
        ))}
      </g>
      <g fontFamily="Inter, sans-serif" fontSize="10" fill="var(--chart-axis)">
        <text x="8" y="14">5s</text>
        <text x="8" y="50">4s</text>
        <text x="8" y="86">3s</text>
        <text x="8" y="122">2s</text>
        <text x="8" y="158">0</text>
      </g>
      <g>
        {WEEK.map((w, i) => {
          const cx = x0 + band * i + band / 2;
          const barH = ((bottom - top) * w.h) / maxH;
          const active = w.h === peak;
          return (
            <g key={w.d}>
              <rect
                x={cx - barW / 2}
                y={bottom - barH}
                width={barW}
                height={barH}
                rx="6"
                fill={active ? "var(--chart-bar-active)" : "var(--chart-bar)"}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "bottom",
                  transform: seen ? "scaleY(1)" : "scaleY(0)",
                  transition: `transform .7s cubic-bezier(.2,.7,.2,1) ${i * 70}ms`,
                }}
              />
              <text x={cx} y="174" fontFamily="Inter, sans-serif" fontSize="10" fill="var(--chart-axis)" textAnchor="middle">
                {w.d}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

const SLICES = [
  { label: "Ta’lim", pct: 34, color: "var(--cat-teal)" },
  { label: "O’yin", pct: 28, color: "var(--cat-blue)" },
  { label: "Ijtimoiy", pct: 22, color: "var(--cat-amber)" },
  { label: "Boshqa", pct: 16, color: "var(--cat-slate)" },
];

export function CategoryDonut() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const C = 326.73; // r = 52
  const arcs = SLICES.map((s, i) => {
    const len = (C * s.pct) / 100;
    const offset = -SLICES.slice(0, i).reduce((sum, p) => sum + (C * p.pct) / 100, 0);
    return { ...s, len, offset };
  });
  return (
    <div className="donut-wrap" ref={ref}>
      <div className="donut">
        <svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label="Faoliyat kategoriyalari — namunaviy">
          <g transform="rotate(-90 60 60)" fill="none">
            <circle cx="60" cy="60" r="52" stroke="var(--chart-track)" strokeWidth="16" />
            {arcs.map((a) => (
              <circle
                key={a.label}
                cx="60"
                cy="60"
                r="52"
                stroke={a.color}
                strokeWidth="16"
                strokeDasharray={`${Math.max(a.len - 1.5, 0)} ${C - a.len + 1.5}`}
                strokeDashoffset={a.offset}
                strokeLinecap="round"
                style={{
                  opacity: seen ? 1 : 0,
                  transform: seen ? "none" : "scale(.9)",
                  transformOrigin: "center",
                  transition: "opacity .5s ease, transform .6s cubic-bezier(.2,.7,.2,1)",
                }}
              />
            ))}
          </g>
        </svg>
        <div className="donut-center">
          <b>4s 40d</b>
          <small>bugun</small>
        </div>
      </div>
      <ul className="legend">
        {SLICES.map((s, i) => (
          <li key={s.label} style={{ opacity: seen ? 1 : 0, transition: `opacity .4s ease ${200 + i * 90}ms` }}>
            <i style={{ background: s.color }} />
            {s.label}
            <span>{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
