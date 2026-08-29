"use client";

import { useState } from "react";

type Day = { date: string; total_minutes: number };

const WEEKDAYS_UZ = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

// Weekly (or 30-day) screen-time bars: value on top of each bar, dashed hour
// gridlines, today's bar in solid blue.
export default function ScreenTimeChart({ data }: { data: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const days = data.slice(-Math.min(data.length, 31));
  const n = Math.max(days.length, 1);

  const W = 560;
  const H = 220;
  const padL = 34;
  const padB = 34;
  const padT = 26;
  const plotH = H - padT - padB;
  const plotW = W - padL - 8;

  const maxMin = Math.max(60, ...days.map((d) => d.total_minutes));
  const maxHours = Math.max(2, Math.ceil(maxMin / 60 / 2) * 2);
  const maxScale = maxHours * 60;
  const yLines = [0, 0.25, 0.5, 0.75, 1];

  const band = plotW / n;
  const barW = Math.min(band * 0.46, 30);

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ekran vaqti grafigi">
        {yLines.map((f) => {
          const y = padT + plotH * (1 - f);
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - 4} y2={y} stroke="rgba(37,99,235,.12)" strokeWidth="1" strokeDasharray={f === 0 ? "0" : "3 4"} />
              <text x={padL - 8} y={y + 3.5} fontSize="10" fill="#9aa6b6" textAnchor="end">
                {f === 0 ? "0" : `${Math.round(maxHours * f)}s`}
              </text>
            </g>
          );
        })}

        {days.map((d, i) => {
          const isLast = i === days.length - 1;
          const h = Math.max((d.total_minutes / maxScale) * plotH, d.total_minutes > 0 ? 3 : 0);
          const x = padL + band * i + (band - barW) / 2;
          const y = padT + plotH - h;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
              <rect x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent" />
              {h > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={Math.min(barW / 2, 8)}
                  fill={isLast ? "#2563eb" : "#a9c9fb"}
                  opacity={hover !== null && hover !== i ? 0.55 : 1}
                  style={{ transition: "opacity .12s" }}
                />
              )}
              {d.total_minutes > 0 && (
                <text x={x + barW / 2} y={y - 7} fontSize="10.5" fontWeight="700" fill={isLast || hover === i ? "#1f2b3a" : "#7a8698"} textAnchor="middle">
                  {fmtDur(d.total_minutes)}
                </text>
              )}
              <text
                x={padL + band * i + band / 2}
                y={H - padB + 18}
                fontSize="11"
                fontWeight={isLast ? 800 : 600}
                fill={isLast ? "#2563eb" : "#7a8698"}
                textAnchor="middle"
              >
                {n <= 10 ? WEEKDAYS_UZ[new Date(d.date + "T00:00:00").getDay()] : (i % 3 === 0 ? shortDate(d.date) : "")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function fmtDur(min: number): string {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} soat ${m} min` : `${h} soat`;
}
