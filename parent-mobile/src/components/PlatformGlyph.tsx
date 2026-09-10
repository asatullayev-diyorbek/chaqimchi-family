import React from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { colors } from "../theme";

type Platform = "windows" | "android" | "ios";

/** The device's OS logo, drawn as a small monochrome glyph for the device
 *  avatar tile. Falls back to the Windows mark for an unknown platform. */
export function PlatformGlyph({
  platform,
  size = 20,
  color = colors.blue,
}: {
  platform: Platform | string;
  size?: number;
  color?: string;
}) {
  if (platform === "ios") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill={color}
          d="M15.53 3.83c.84-1.01 1.4-2.43 1.25-3.83-1.21.05-2.66.8-3.53 1.82-.78.9-1.46 2.34-1.27 3.71 1.34.1 2.71-.69 3.55-1.7zM17.05 12.02c-.03-3.05 2.49-4.51 2.6-4.58-1.42-2.1-3.64-2.33-4.42-2.38-1.88-.19-3.67 1.11-4.62 1.11-.95 0-2.42-1.08-3.98-1.05-2.05.03-3.94 1.19-4.99 3.02-2.13 3.7-.54 9.17 1.52 12.17 1.01 1.47 2.21 3.11 3.79 3.05 1.51-.06 2.09-.98 3.92-.98 1.82 0 2.34.98 3.94.95 1.63-.03 2.66-1.49 3.66-2.96 1.15-1.69 1.62-3.32 1.65-3.41-.04-.02-3.16-1.23-3.19-4.86z"
        />
      </Svg>
    );
  }
  if (platform === "android") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Line x1={7.5} y1={3.5} x2={9} y2={6} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        <Line x1={16.5} y1={3.5} x2={15} y2={6} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        <Path
          fill={color}
          d="M5 11.5a7 7 0 0 1 14 0V18a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 18z"
        />
        <Circle cx={9.3} cy={10.4} r={1} fill={colors.surface} />
        <Circle cx={14.7} cy={10.4} r={1} fill={colors.surface} />
      </Svg>
    );
  }
  // windows (default) — the four-pane mark
  const g = 2.4;
  const s = (24 - g * 3) / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={g} y={g} width={s} height={s} rx={1.4} fill={color} />
      <Rect x={g * 2 + s} y={g} width={s} height={s} rx={1.4} fill={color} />
      <Rect x={g} y={g * 2 + s} width={s} height={s} rx={1.4} fill={color} />
      <Rect x={g * 2 + s} y={g * 2 + s} width={s} height={s} rx={1.4} fill={color} />
    </Svg>
  );
}

/** Colour for a battery level: red when low, amber mid, green when healthy. */
export function batteryColor(level: number): string {
  if (level <= 20) return colors.danger;
  if (level <= 50) return colors.warning;
  return colors.success;
}

/** A horizontal battery whose fill tracks `level` (0-100) and whose colour
 *  goes red → amber → green as it fills. */
export function BatteryGauge({ level, width = 24 }: { level: number; width?: number }) {
  const pct = Math.max(0, Math.min(100, level));
  const color = batteryColor(pct);
  const height = width * (14 / 26);
  // Geometry in a 26×14 viewBox: 20-wide body, ~17 usable inner width.
  const fillW = (17 * pct) / 100;
  return (
    <Svg width={width} height={height} viewBox="0 0 26 14">
      <Rect x={1} y={2} width={20} height={10} rx={2.6} fill="none" stroke={colors.faint} strokeWidth={1.4} />
      <Rect x={22} y={4.5} width={2.6} height={5} rx={1} fill={colors.faint} />
      {fillW > 0 ? <Rect x={2.5} y={3.5} width={fillW} height={7} rx={1} fill={color} /> : null}
    </Svg>
  );
}
