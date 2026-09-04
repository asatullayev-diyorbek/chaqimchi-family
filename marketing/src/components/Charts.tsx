"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_WEEK, DEMO_CATEGORIES } from "@/lib/site";

// SVG charts styled to match the parent-web dashboard (same viewBox, grid,
// axis and bar tokens). Sample data lives in site.ts. Both animate the first
// time they scroll into view and expose native tooltips + a hover highlight.

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fallback for environments without IO
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

function hm(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}s ${m}d` : `${m}d`;
}

export function WeekBars() {
  const { ref, seen } = useInView<SVGSVGElement>();
  const [hover, setHover] = useState<number | null>(null);
  const maxM = Math.max(300, ...DEMO_WEEK.map((v) => v.m));
  const x0 = 40;
  const x1 = 540;
  const top = 10;
  const bottom = 154;
  const band = (x1 - x0) / DEMO_WEEK.length;
  const barW = 26;
  const peak = Math.max(...DEMO_WEEK.map((v) => v.m));

  return (
    <svg
      ref={ref}
      className="graph"
      viewBox="0 0 560 190"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="7 kunlik ekran vaqti"
      onMouseLeave={() => setHover(null)}
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
        {DEMO_WEEK.map((w, i) => {
          const cx = x0 + band * i + band / 2;
          const barH = ((bottom - top) * w.m) / maxM;
          const active = w.m === peak;
          const on = hover === i;
          return (
            <g key={w.d} onMouseEnter={() => setHover(i)}>
              <rect x={cx - band / 2} y={top} width={band} height={bottom - top} fill="transparent" />
              <rect
                x={cx - barW / 2}
                y={bottom - barH}
                width={barW}
                height={barH}
                rx="6"
                fill={active || on ? "var(--chart-bar-active)" : "var(--chart-bar)"}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "bottom",
                  transform: seen ? "scaleY(1)" : "scaleY(0)",
                  transition: `transform .7s cubic-bezier(.2,.7,.2,1) ${i * 70}ms, fill .15s`,
                }}
              >
                <title>{`${w.d}: ${hm(w.m)}`}</title>
              </rect>
              {on && (
                <text x={cx} y={bottom - barH - 8} fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700" fill="var(--fg)" textAnchor="middle">
                  {hm(w.m)}
                </text>
              )}
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

export function CategoryDonut() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const C = 326.73; // r = 52
  const arcs = DEMO_CATEGORIES.map((s, i) => {
    const len = (C * s.pct) / 100;
    const offset = -DEMO_CATEGORIES.slice(0, i).reduce((sum, p) => sum + (C * p.pct) / 100, 0);
    return { ...s, len, offset };
  });
  return (
    <div className="donut-wrap" ref={ref} onMouseLeave={() => setHover(null)}>
      <div className="donut">
        <svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label="Faoliyat kategoriyalari">
          <g transform="rotate(-90 60 60)" fill="none">
            <circle cx="60" cy="60" r="52" stroke="var(--chart-track)" strokeWidth="16" />
            {arcs.map((a, i) => (
              <circle
                key={a.label}
                cx="60"
                cy="60"
                r="52"
                stroke={a.color}
                strokeWidth={hover === i ? 19 : 16}
                strokeDasharray={`${Math.max(a.len - 1.5, 0)} ${C - a.len + 1.5}`}
                strokeDashoffset={a.offset}
                strokeLinecap="round"
                onMouseEnter={() => setHover(i)}
                style={{
                  opacity: seen ? (hover !== null && hover !== i ? 0.45 : 1) : 0,
                  transform: seen ? "none" : "scale(.9)",
                  transformOrigin: "center",
                  transition: "opacity .3s ease, transform .6s cubic-bezier(.2,.7,.2,1), stroke-width .15s",
                }}
              >
                <title>{`${a.label}: ${a.pct}%`}</title>
              </circle>
            ))}
          </g>
        </svg>
        <div className="donut-center">
          <b>4s 40d</b>
          <small>bugun</small>
        </div>
      </div>
      <ul className="legend">
        {DEMO_CATEGORIES.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ opacity: seen ? 1 : 0, transition: `opacity .4s ease ${200 + i * 90}ms` }}
          >
            <i style={{ background: s.color }} />
            {s.label}
            <span>{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 7-bar weekly chart for the hero panel. Taller than a sparkline, with a
 *  hover label showing the day's time. */
export function MiniWeek() {
  const { ref, seen } = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const maxM = Math.max(...DEMO_WEEK.map((v) => v.m));
  const peak = maxM;
  return (
    <div className="mini-week" ref={ref} onMouseLeave={() => setHover(null)}>
      {DEMO_WEEK.map((w, i) => {
        const on = hover === i;
        return (
          <div
            key={w.d}
            className={`mini-week-col${on ? " on" : ""}`}
            onMouseEnter={() => setHover(i)}
          >
            <span className="mini-week-val" aria-hidden>{hm(w.m)}</span>
            <div className="mini-week-track">
              <div
                className="mini-week-bar"
                style={{
                  height: seen ? `${Math.max(8, (w.m / maxM) * 100)}%` : "0%",
                  background: on || w.m === peak ? "var(--chart-bar-active)" : "var(--chart-bar)",
                  transition: `height .6s cubic-bezier(.2,.7,.2,1) ${i * 60}ms, background .15s`,
                }}
              />
            </div>
            <span className="mini-week-day">{w.d}</span>
          </div>
        );
      })}
    </div>
  );
}
