import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

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
  if (scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={edges}>
        <ScrollView
          contentContainerStyle={[
            { padding: pad, paddingBottom: pad + 24, gap: spacing.lg, flexGrow: 1 },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
