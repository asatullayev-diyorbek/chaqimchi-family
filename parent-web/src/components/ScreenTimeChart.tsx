"use client";

type Day = { date: string; total_minutes: number };

const WEEKDAYS_UZ = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

// Weekly (or 30-day) screen-time bars. Clicking a bar selects that day; the
// selected bar is solid blue, the rest are light. The value sits on top.
export default function ScreenTimeChart({
  data,
  selected,
  onSelect,
}: {
  data: Day[];
  selected?: string;
  onSelect?: (date: string) => void;
}) {
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
  const maxRowMin = Math.max(...days.map((d) => d.total_minutes), 0);

  const band = plotW / n;
  const barW = Math.min(band * 0.46, 30);

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ekran vaqti grafigi">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = padT + plotH * (1 - f);
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - 4} y2={y} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray={f === 0 ? "0" : "3 4"} />
              <text x={padL - 8} y={y + 3.5} fontSize="10" fill="var(--chart-axis)" textAnchor="end">
                {f === 0 ? "0" : `${Math.round(maxHours * f)}s`}
              </text>
            </g>
          );
        })}

        {days.map((d, i) => {
          const isSel = selected ? d.date === selected : i === days.length - 1;
          const h = Math.max((d.total_minutes / maxScale) * plotH, d.total_minutes > 0 ? 3 : 0);
          const x = padL + band * i + (band - barW) / 2;
          const y = padT + plotH - h;
          const showValue = d.total_minutes > 0 && (n <= 10 || isSel || d.total_minutes === maxRowMin);
          return (
            <g key={d.date} onClick={() => onSelect?.(d.date)} style={{ cursor: onSelect ? "pointer" : "default" }}>
              <rect x={padL + band * i} y={padT} width={band} height={plotH + padB} fill="transparent" />
              {h > 0 && (
                <rect x={x} y={y} width={barW} height={h} rx={Math.min(barW / 2, 8)} fill={isSel ? "var(--chart-bar-active)" : "var(--chart-bar)"} style={{ transition: "fill .12s" }} />
              )}
              {showValue && (
                <text x={x + barW / 2} y={y - 7} fontSize="10.5" fontWeight="700" fill={isSel ? "var(--foreground)" : "var(--muted)"} textAnchor="middle">
                  {fmtDur(d.total_minutes)}
                </text>
              )}
              <text
                x={padL + band * i + band / 2}
                y={H - padB + 18}
                fontSize="11"
                fontWeight={isSel ? 800 : 600}
                fill={isSel ? "var(--chart-bar-active)" : "var(--muted)"}
                textAnchor="middle"
              >
                {n <= 10 ? WEEKDAYS_UZ[new Date(d.date + "T00:00:00").getDay()] : i % 3 === 0 ? shortDate(d.date) : ""}
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
