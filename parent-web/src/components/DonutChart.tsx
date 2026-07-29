"use client";

export type DonutSlice = {
  label: string;
  minutes: number;
  color: string;
};

// Simple categorical donut — fixed hue order per slice (never re-cycled),
// a 2px surface gap between segments so touching slices read as distinct
// without needing a stroke. Center label carries the total as the single
// most important number on the card.
export default function DonutChart({
  slices,
  totalLabel,
  totalSubLabel,
}: {
  slices: DonutSlice[];
  totalLabel: string;
  totalSubLabel: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.minutes, 0) || 1;
  const radius = 70;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;
  const gapDeg = 2.5; // visual gap between segments, in degrees of the circle

  // Precompute each slice's start angle from the running total of the
  // slices before it, via reduce's own accumulator rather than a variable
  // mutated across render — 12 o'clock is -90deg.
  const positioned = slices.reduce<{ slice: DonutSlice; fraction: number; startDeg: number }[]>(
    (acc, slice) => {
      const fraction = slice.minutes / total;
      const prevEnd = acc.length ? acc[acc.length - 1].startDeg + acc[acc.length - 1].fraction * 360 : -90;
      acc.push({ slice, fraction, startDeg: prevEnd });
      return acc;
    },
    []
  );

  return (
    <div style={{ position: "relative", width: 220, height: 220 }}>
      <svg width={220} height={220} viewBox="0 0 220 220">
        {positioned.map(({ slice, fraction, startDeg }) => {
          const sweepDeg = Math.max(fraction * 360 - gapDeg, 0);
          const rotation = startDeg + gapDeg / 2;

          const dashLength = (sweepDeg / 360) * circumference;
          const dashArray = `${dashLength} ${circumference - dashLength}`;

          return (
            <circle
              key={slice.label}
              cx={110}
              cy={110}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              transform={`rotate(${rotation} 110 110)`}
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>{totalLabel}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{totalSubLabel}</div>
      </div>
    </div>
  );
}
