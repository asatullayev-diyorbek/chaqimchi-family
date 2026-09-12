import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { CAT_COLORS, colors, gradients, radius } from "../theme";
import { formatDate, formatMinutes, formatMinutesShort, longWeekday } from "../lib/format";
import { Text } from "./primitives";

// --- Meter (linear progress) --------------------------------------

export function Meter({
  value,
  max,
  tone = "blue",
  height = 8,
}: {
  value: number;
  max: number;
  tone?: "blue" | "warn" | "danger" | "mint";
  height?: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const over = max > 0 && value > max;
  const fill =
    tone === "warn"
      ? colors.warning
      : tone === "danger" || over
        ? colors.danger
        : tone === "mint"
          ? colors.mint
          : colors.chartBarActive;
  return (
    <View
      style={{
        height,
        borderRadius: 999,
        backgroundColor: colors.chartTrack,
        overflow: "hidden",
        flexDirection: "row",
      }}
    >
      <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: fill }} />
      {over ? <View style={{ flex: 1, height: "100%", backgroundColor: `${colors.danger}33` }} /> : null}
    </View>
  );
}

// --- RingProgress (used vs limit) --------------------------------

export function RingProgress({
  value,
  max,
  size = 176,
  stroke = 15,
  centerTop,
  centerBottom,
  tone,
}: {
  value: number;
  max: number | null;
  size?: number;
  stroke?: number;
  /** Keep this SHORT (e.g. "4s 18d") — it must fit inside the ring. */
  centerTop: string;
  centerBottom?: string;
  tone?: "blue" | "warn" | "danger";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const raw = max && max > 0 ? value / max : 0;
  const ratio = Math.min(1, raw);
  const over = max != null && max > 0 && value > max;
  const cx = size / 2;

  const grad =
    over || tone === "danger"
      ? gradients.ringDanger
      : tone === "warn" || (raw > 0.85 && !over)
        ? gradients.ringWarn
        : gradients.ring;

  // Fit the big label inside the inner circle.
  const inner = size - 2 * stroke - 20;
  const bigSize = centerTop.length > 6 ? 22 : centerTop.length > 4 ? 26 : 30;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={grad[0]} />
            <Stop offset="1" stopColor={grad[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={cx} cy={cx} r={r} stroke={colors.chartTrack} strokeWidth={stroke} fill="none" />
        {max != null && over ? (
          // At/over the limit — a solid full ring reads clearer than a
          // near-complete arc with a confusing detached stub.
          <Circle cx={cx} cy={cx} r={r} stroke="url(#ringGrad)" strokeWidth={stroke} fill="none" />
        ) : max != null && ratio > 0 ? (
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke="url(#ringGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * ratio} ${c}`}
            fill="none"
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        ) : null}
      </Svg>
      <View style={{ width: inner, alignItems: "center" }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontSize: bigSize, lineHeight: bigSize + 4, fontWeight: "800", color: colors.text }}
        >
          {centerTop}
        </Text>
        {centerBottom ? (
          <Text
            variant="caption"
            color={over ? colors.danger : colors.muted}
            style={{ marginTop: 3, textAlign: "center" }}
            numberOfLines={2}
          >
            {centerBottom}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// --- WeekBars (7/30-day screen time) ----------------------------

type Day = { label: string; minutes: number; weekend?: boolean; date?: string };

/** A "nice" hour step for the Y-axis (0.5h/1h/2h/3h/...) so gridlines read
 *  as round numbers instead of an arbitrary fraction of the day's max. */
function niceHourStep(maxHours: number): number {
  if (maxHours <= 1) return 0.5;
  if (maxHours <= 3) return 1;
  if (maxHours <= 6) return 2;
  if (maxHours <= 12) return 3;
  return Math.ceil(maxHours / 4);
}

function hourTickLabel(hours: number): string {
  return Number.isInteger(hours) ? `${hours}s` : `${Math.round(hours * 60)}d`;
}

export function WeekBars({
  days,
  showValues = false,
  height = 132,
  showAverage = true,
}: {
  days: Day[];
  showValues?: boolean;
  height?: number;
  showAverage?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const { rawMax, avg } = useMemo(() => {
    const vals = days.map((d) => d.minutes);
    const nonZero = vals.filter((v) => v > 0);
    return {
      rawMax: Math.max(60, ...vals),
      avg: nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0,
    };
  }, [days]);

  const hourStep = niceHourStep(rawMax / 60);
  const topHour = Math.max(hourStep, Math.ceil(rawMax / 60 / hourStep) * hourStep);
  const maxMin = topHour * 60;
  const hourTicks = useMemo(() => {
    const out: number[] = [];
    for (let h = hourStep; h <= topHour + 1e-9; h += hourStep) out.push(h);
    return out;
  }, [hourStep, topHour]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const padTop = showValues ? 16 : 6;
  const axisH = 16;
  const axisW = 24;
  const plotH = height - axisH - padTop;
  const plotW = Math.max(0, width - axisW);
  const dense = days.length > 10;
  const barW = dense ? Math.max(4, plotW / days.length - 4) : Math.min(20, plotW / days.length - 10);
  const step = plotW / days.length;
  const yFor = (m: number) => padTop + plotH - Math.min(1, m / maxMin) * plotH;

  const activeDay = activeIdx != null ? days[activeIdx] : null;

  return (
    <View style={{ gap: 6 }}>
      <Text variant="micro" color={colors.muted} numberOfLines={1} style={{ minHeight: 15 }}>
        {activeDay
          ? `${activeDay.date ? `${longWeekday(activeDay.date)}, ${formatDate(activeDay.date)}` : activeDay.label} — ${formatMinutes(activeDay.minutes)}`
          : ""}
      </Text>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={gradients.bar[1]} />
                  <Stop offset="1" stopColor={gradients.bar[0]} />
                </LinearGradient>
                <LinearGradient id="barActive" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={gradients.barActive[0]} />
                  <Stop offset="1" stopColor={gradients.barActive[1]} />
                </LinearGradient>
              </Defs>

              {/* hour gridlines */}
              {hourTicks.map((h) => (
                <Line
                  key={h}
                  x1={axisW}
                  x2={width}
                  y1={yFor(h * 60)}
                  y2={yFor(h * 60)}
                  stroke={colors.chartGrid}
                  strokeWidth={1}
                />
              ))}
              {/* baseline */}
              <Line
                x1={axisW}
                x2={width}
                y1={padTop + plotH}
                y2={padTop + plotH}
                stroke={colors.border}
                strokeWidth={1}
              />

              {/* average line */}
              {showAverage && avg > 0 && (
                <Line
                  x1={axisW}
                  x2={width}
                  y1={yFor(avg)}
                  y2={yFor(avg)}
                  stroke={colors.mintDark}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              )}

              {days.map((d, i) => {
                const x = axisW + i * step + step / 2;
                // The last bar is "today" in a trailing-N-days chart — give it
                // the strongest fill so the parent's eye lands there first.
                const isToday = i === days.length - 1;
                const isActive = activeIdx === i;
                if (d.minutes <= 0) {
                  return (
                    <Circle
                      key={i}
                      cx={x}
                      cy={padTop + plotH - 2}
                      r={isToday ? 3 : 2}
                      fill={isToday ? colors.chartBarActive : colors.chartAxis}
                    />
                  );
                }
                const y = yFor(d.minutes);
                return (
                  <Rect
                    key={i}
                    x={x - barW / 2}
                    y={y}
                    width={barW}
                    height={padTop + plotH - y}
                    rx={Math.min(6, barW / 2)}
                    fill={isToday || isActive ? "url(#barActive)" : "url(#barGrad)"}
                  />
                );
              })}
            </Svg>

            {/* hour-axis labels (RN Text overlaid for crisp rendering) */}
            <View style={{ position: "absolute", left: 0, top: 0, width: axisW - 4, height: padTop + plotH }}>
              {hourTicks.map((h) => (
                <Text
                  key={h}
                  variant="micro"
                  color={colors.chartAxis}
                  numberOfLines={1}
                  style={{ position: "absolute", top: yFor(h * 60) - 6, left: 0, right: 0, textAlign: "right" }}
                >
                  {hourTickLabel(h)}
                </Text>
              ))}
            </View>

            {/* value labels + tap targets + weekday axis */}
            <View style={{ position: "absolute", left: axisW, right: 0, top: 0, height, flexDirection: "row" }}>
              {days.map((d, i) => (
                <Pressable
                  key={i}
                  onPress={() => setActiveIdx(activeIdx === i ? null : i)}
                  style={{ flex: 1, alignItems: "center", justifyContent: "space-between", paddingTop: 0 }}
                >
                  <Text variant="micro" color={colors.faint} style={{ height: padTop }}>
                    {(showValues || activeIdx === i) && d.minutes ? formatMinutesShort(d.minutes) : ""}
                  </Text>
                  <Text
                    variant="micro"
                    color={
                      activeIdx === i || i === days.length - 1
                        ? colors.blue
                        : d.weekend
                          ? colors.warning
                          : colors.chartAxis
                    }
                    style={{ height: axisH }}
                  >
                    {dense ? (i % 5 === 0 || i === days.length - 1 ? d.label : "") : d.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// --- Sparkline (tiny trend, e.g. child card) --------------------

export function Sparkline({
  values,
  width = 72,
  height = 24,
  color = colors.blue,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pt = (v: number, i: number) => [i * step, height - 3 - (v / max) * (height - 6)] as const;
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${pt(v, i)[0]},${pt(v, i)[1]}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#sparkFill)" />
      <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// --- SplitBar (proportional stack + legend) --------------------

export function SplitBar({ items }: { items: { label: string; minutes: number }[] }) {
  const total = items.reduce((s, x) => s + x.minutes, 0) || 1;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", height: 12, gap: 3 }}>
        {items.map((it, i) => (
          <View
            key={it.label}
            style={{
              flex: Math.max(0.04, it.minutes / total),
              backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
              borderRadius: 999,
            }}
          />
        ))}
      </View>
      <View style={{ gap: 9 }}>
        {items.map((it, i) => (
          <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
              }}
            />
            <Text variant="label" color={colors.body} style={{ flex: 1 }} numberOfLines={1}>
              {it.label}
            </Text>
            <Text variant="caption" color={colors.muted}>
              {formatMinutesShort(it.minutes)}
            </Text>
            <Text variant="micro" color={colors.faint} style={{ width: 34, textAlign: "right" }}>
              {Math.round((it.minutes / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// --- DayTimeline (0..24h per-app lanes) -----------------------

import { appDisplay } from "../lib/appDisplay";
import { Block, BUCKET_META, Bucket, bucketOf, foldBlocks } from "../lib/timeline";
import { TimelineSegment } from "../api/tracking";
import { AppIcon } from "./AppIcon";

const AXIS_HOURS = [0, 6, 12, 18, 24];
const TRACK_H = 20;

type Lane = {
  app_id: string;
  app_name: string;
  icon: string | null;
  color: string;
  bucket: Bucket;
  totalMin: number;
  blocks: Block[];
};

export function DayTimeline({
  segments,
  nowMinute,
}: {
  segments: TimelineSegment[];
  /** minute-of-day for the "hozir" marker; omit for a past day */
  nowMinute?: number | null;
}) {
  const [width, setWidth] = useState(0);

  const lanes: Lane[] = useMemo(() => {
    const byApp = new Map<string, TimelineSegment[]>();
    for (const s of segments) {
      const arr = byApp.get(s.app_id) ?? [];
      arr.push(s);
      byApp.set(s.app_id, arr);
    }
    return [...byApp.entries()]
      .map(([app_id, parts]) => {
        const d = appDisplay(app_id, parts[0].app_name);
        const bucket = bucketOf(app_id, d.category);
        return {
          app_id,
          app_name: parts[0].app_name,
          icon: parts.find((p) => p.icon)?.icon ?? null,
          color: BUCKET_META[bucket].color,
          bucket,
          totalMin: parts.reduce((t, p) => t + (p.end_minute - p.start_minute), 0),
          blocks: foldBlocks(parts),
        };
      })
      .sort((a, b) => b.totalMin - a.totalMin)
      .slice(0, 10);
  }, [segments]);

  const usedBuckets = [...new Set(lanes.map((l) => l.bucket))];
  const xFor = (min: number) => (min / 1440) * width;

  return (
    <View style={{ gap: 12 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {AXIS_HOURS.map((h) => (
          <Text key={h} variant="micro" color={colors.chartAxis}>
            {String(h).padStart(2, "0")}:00
          </Text>
        ))}
      </View>

      {width > 0 &&
        lanes.map((lane) => {
          const d = appDisplay(lane.app_id, lane.app_name);
          return (
            <View key={lane.app_id} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <AppIcon appId={lane.app_id} appName={lane.app_name} icon={lane.icon} size={22} />
                <Text variant="caption" color={colors.body} style={{ flex: 1 }} numberOfLines={1}>
                  {d.label}
                </Text>
                <Text variant="micro" color={colors.faint}>
                  {formatMinutesShort(lane.totalMin)}
                </Text>
              </View>
              <Svg width={width} height={TRACK_H}>
                <Defs>
                  <LinearGradient id={`lane-${lane.app_id}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={lane.color} stopOpacity={0.95} />
                    <Stop offset="1" stopColor={lane.color} stopOpacity={0.75} />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={width} height={TRACK_H} rx={7} fill={colors.chartTrack} />
                {AXIS_HOURS.map((h) => (
                  <Line
                    key={h}
                    x1={xFor(h * 60)}
                    x2={xFor(h * 60)}
                    y1={0}
                    y2={TRACK_H}
                    stroke={colors.chartGrid}
                    strokeWidth={1}
                  />
                ))}
                {lane.blocks.map((b, i) => {
                  const x = xFor(b.start);
                  const w = Math.max(3, xFor(b.end) - x);
                  return <Rect key={i} x={x} y={0} width={w} height={TRACK_H} rx={6} fill={`url(#lane-${lane.app_id})`} />;
                })}
                {typeof nowMinute === "number" && (
                  <Line
                    x1={xFor(nowMinute)}
                    x2={xFor(nowMinute)}
                    y1={-2}
                    y2={TRACK_H + 2}
                    stroke={colors.blue}
                    strokeWidth={2}
                  />
                )}
              </Svg>
            </View>
          );
        })}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 2 }}>
        {usedBuckets.map((b) => (
          <View key={b} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BUCKET_META[b].color }} />
            <Text variant="micro" color={colors.muted}>
              {BUCKET_META[b].label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
