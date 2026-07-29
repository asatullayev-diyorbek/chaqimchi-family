"use client";

import { useState } from "react";

export type BarDatum = {
  label: string;
  value: number;
};

// Single-series magnitude chart (minutes per day) — one hue, thin bars,
// rounded data-ends, hairline baseline, hover tooltip. No legend: with one
// series the chart's own heading already says what's plotted.
// limitMinutes (optional, real data when passed — the device's actual
// daily_limit_minutes rule) draws a dashed reference line, matching the
// "Kunlik limit" line in the reference dashboard design.
export default function BarChart({
  data,
  unit = "daq",
  limitMinutes,
}: {
  data: BarDatum[];
  unit?: string;
  limitMinutes?: number | null;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = Math.max(1, limitMinutes ?? 0, ...data.map((d) => d.value));
  const height = 160;
  const barWidth = 24;
  const gap = Math.max(8, 320 / Math.max(1, data.length) - barWidth);
  const width = data.length * (barWidth + gap);
  const limitY = limitMinutes ? height - (limitMinutes / max) * (height - 8) : null;

  return (
    <div style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height + 24}`} style={{ overflow: "visible" }}>
        <line x1={0} y1={height} x2={width} y2={height} stroke="var(--border)" strokeWidth={1} />

        {limitY !== null && (
          <>
            <line
              x1={0}
              y1={limitY}
              x2={width}
              y2={limitY}
              stroke="var(--cat-amber)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text x={width} y={limitY - 6} textAnchor="end" fontSize={11} fill="var(--cat-amber)">
              Kunlik limit
            </text>
          </>
        )}

        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 8);
          const x = i * (barWidth + gap) + gap / 2;
          const y = height - barHeight;
          const hovered = hoverIndex === i;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={barHeight > 0 ? y : height - 2}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={4}
                fill={hovered ? "var(--accent-dark)" : "var(--accent)"}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{ cursor: "default" }}
              />
              <text
                x={x + barWidth / 2}
                y={height + 16}
                textAnchor="middle"
                fontSize={11}
                fill="var(--muted)"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hoverIndex !== null && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${(hoverIndex * (barWidth + gap) + gap / 2) / width * 100}%`,
            transform: "translate(-50%, -100%)",
            background: "var(--foreground)",
            color: "#fff",
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {data[hoverIndex].label}: {data[hoverIndex].value} {unit}
        </div>
      )}
    </div>
  );
}
