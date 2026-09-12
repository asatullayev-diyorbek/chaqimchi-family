import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeTouchEvent,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

const PULL_THRESHOLD = 64;
const PULL_MAX = 90;
const INDICATOR_H = 44;

/**
 * react-native-web's <RefreshControl> is a stub — it renders a plain <View>
 * and never calls onRefresh, so pull-to-refresh silently does nothing on
 * the web build (which is what the Telegram Mini App actually runs). This
 * reimplements the gesture by hand for web only; native keeps the real
 * RefreshControl untouched.
 */
function useWebPullToRefresh(onRefresh?: () => void) {
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);
  const atTop = useRef(true);

  if (Platform.OS !== "web" || !onRefresh) {
    return { pull: 0, atTopHandlers: {} as Record<string, never> };
  }

  const onScroll = (e: any) => {
    atTop.current = (e.nativeEvent.contentOffset?.y ?? 0) <= 0;
  };
  const onTouchStart = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    startY.current = atTop.current ? e.nativeEvent.touches[0]?.pageY ?? null : null;
  };
  const onTouchMove = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    if (startY.current == null) return;
    const dy = (e.nativeEvent.touches[0]?.pageY ?? startY.current) - startY.current;
    if (dy > 0 && atTop.current) setPull(Math.min(PULL_MAX, dy * 0.5));
    else {
      startY.current = null;
      setPull(0);
    }
  };
  const onTouchEnd = () => {
    if (pull >= PULL_THRESHOLD) onRefresh();
    startY.current = null;
    setPull(0);
  };

  return { pull, atTopHandlers: { onScroll, onTouchStart, onTouchMove, onTouchEnd } };
}

/**
 * Standard screen frame: safe-area top, page background, 20px gutters.
 * Pass `scroll` for scrollable content, and `onRefresh` for pull-to-refresh.
 */
export function Screen({
  children,
  scroll = false,
  refreshing = false,
  onRefresh,
  contentStyle,
  edges = ["top", "left", "right"],
  gutter = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  edges?: ("top" | "bottom" | "left" | "right")[];
  gutter?: boolean;
}) {
  const pad = gutter ? spacing.xl : 0;
  const { pull, atTopHandlers } = useWebPullToRefresh(onRefresh);
  const showWebIndicator = Platform.OS === "web" && !!onRefresh;
  const indicatorHeight = refreshing ? INDICATOR_H : Math.min(INDICATOR_H, pull);

  if (scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={edges}>
        {showWebIndicator ? (
          <View style={{ height: indicatorHeight, alignItems: "center", justifyContent: "flex-end" }}>
            {indicatorHeight > 4 ? <ActivityIndicator color={colors.blue} /> : null}
          </View>
        ) : null}
        <ScrollView
          contentContainerStyle={[
            { padding: pad, paddingBottom: pad + 24, gap: spacing.lg, flexGrow: 1 },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...atTopHandlers}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.blue}
                colors={[colors.blue]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={edges}>
      <View style={[{ flex: 1, padding: pad, gap: spacing.lg }, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
