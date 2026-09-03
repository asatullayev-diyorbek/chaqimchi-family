import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Palette mirrors parent-web/src/app/globals.css and the marketing site so
// all three surfaces read as one product (light only).
export const colors = {
  background: "#eef1fb",
  surface: "#ffffff",
  surfaceMuted: "#f7f9fd",
  text: "#1f2b3a",
  body: "#4c5d78",
  muted: "#7a8698",
  border: "#e7ebf2",
  blue: "#2563eb",
  blueSoft: "#e8f0ff",
  mint: "#2fbfa6",
  mintDark: "#22a68c",
  mintSoft: "#d8f5ee",
  warning: "#f28a3a",
  danger: "#f5455a",
  // categorical set — parent-web --cat-*
  catTeal: "#2fc8ad",
  catBlue: "#6f97f0",
  catAmber: "#f5c04e",
  catPurple: "#a78bfa",
  catSlate: "#c7cfd8",
  // chart tokens — parent-web --chart-*
  chartGrid: "rgba(37,99,235,0.10)",
  chartTrack: "rgba(37,99,235,0.06)",
  chartAxis: "#9aa6b6",
  chartBar: "#a9c9fb",
  chartBarActive: "#2563eb",
};

export const CAT_COLORS = [colors.catTeal, colors.catBlue, colors.catAmber, colors.catPurple, colors.catSlate];

// --- Charts (plain Views, no SVG dependency) ---

export function Meter({ value, max, tone = "blue" }: { value: number; max: number; tone?: "blue" | "warn" }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <View style={styles.meterTrack}>
      <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: tone === "warn" ? colors.warning : colors.chartBarActive }]} />
    </View>
  );
}

/** 7-day screen-time bars. `days` is [{ label, minutes }] oldest→newest. */
export function WeekBars({ days }: { days: { label: string; minutes: number }[] }) {
  const maxMin = Math.max(60, ...days.map((d) => d.minutes));
  const peak = Math.max(...days.map((d) => d.minutes));
  return (
    <View style={styles.weekWrap}>
      {days.map((d, i) => {
        const h = Math.max(4, Math.round((d.minutes / maxMin) * 96));
        return (
          <View key={i} style={styles.weekCol}>
            <View style={styles.weekBarArea}>
              <View style={[styles.weekBar, { height: h, backgroundColor: d.minutes === peak && peak > 0 ? colors.chartBarActive : colors.chartBar }]} />
            </View>
            <Text style={styles.weekLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Stacked proportion bar + legend — the mobile take on the dashboard donut. */
export function SplitBar({ items }: { items: { label: string; minutes: number }[] }) {
  const total = items.reduce((s, x) => s + x.minutes, 0) || 1;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.splitTrack}>
        {items.map((it, i) => (
          <View key={it.label} style={{ flex: it.minutes / total, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
        ))}
      </View>
      <View style={{ gap: 8 }}>
        {items.map((it, i) => (
          <View key={it.label} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
            <Text numberOfLines={1} style={styles.legendLabel}>{it.label}</Text>
            <Text style={styles.legendVal}>{Math.round((it.minutes / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Screen({ children, scroll = false, refreshControl }: { children: React.ReactNode; scroll?: boolean; refreshControl?: React.ReactElement }) {
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={refreshControl}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ title, onPress, disabled = false, loading = false }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.primaryButton, (disabled || loading) && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.secondaryButton, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}><Text style={styles.secondaryButtonText}>{title}</Text></Pressable>;
}

export function Field({ style, ...props }: TextInputProps) {
  return <TextInput placeholderTextColor="#94a3b8" {...props} style={[styles.field, style]} />;
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screenContent: { flex: 1, padding: 20, gap: 16 },
  scrollContent: { flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: "rgba(255,255,255,.9)", borderRadius: 20, padding: 18, shadowColor: "#64748b", shadowOpacity: .10, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: colors.blue, justifyContent: "center", alignItems: "center", paddingHorizontal: 18 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#c9d8fb", backgroundColor: colors.blueSoft, justifyContent: "center", alignItems: "center", paddingHorizontal: 14 },
  secondaryButtonText: { color: colors.blue, fontSize: 15, fontWeight: "700" },
  buttonDisabled: { opacity: .55 },
  buttonPressed: { opacity: .82, transform: [{ scale: .99 }] },
  field: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  meterTrack: { height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 999 },
  weekWrap: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 128, paddingTop: 4 },
  weekCol: { flex: 1, alignItems: "center", gap: 8 },
  weekBarArea: { height: 96, justifyContent: "flex-end" },
  weekBar: { width: 20, borderRadius: 6 },
  weekLabel: { fontSize: 11, color: colors.chartAxis, fontWeight: "700" },
  splitTrack: { flexDirection: "row", height: 14, borderRadius: 999, overflow: "hidden", backgroundColor: colors.chartTrack },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 11, height: 11, borderRadius: 4 },
  legendLabel: { flex: 1, color: colors.body, fontWeight: "600", fontSize: 14 },
  legendVal: { color: colors.muted, fontWeight: "700", fontSize: 13 },
});
