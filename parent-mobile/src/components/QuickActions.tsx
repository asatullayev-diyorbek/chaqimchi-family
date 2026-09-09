import React from "react";
import { Pressable, View } from "react-native";
import { colors, radius } from "../theme";
import { Icon, IconName } from "./Icon";
import { Text } from "./primitives";

export type QuickAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: "blue" | "mint" | "amber" | "muted";
  disabled?: boolean;
};

const TONES: Record<NonNullable<QuickAction["tone"]>, { fg: string; bg: string }> = {
  blue: { fg: colors.blue, bg: colors.blueSoft },
  mint: { fg: colors.mintDark, bg: colors.mintSoft },
  amber: { fg: colors.warning, bg: colors.warningSoft },
  muted: { fg: colors.muted, bg: colors.surfaceSunken },
};

/** A single row of compact action tiles (icon + short label). */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {actions.map((a) => {
        const t = TONES[a.tone ?? "blue"];
        return (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            disabled={a.disabled}
            accessibilityRole="button"
            style={({ pressed }) => [
              {
                flex: 1,
                alignItems: "center",
                gap: 7,
                paddingVertical: 12,
                paddingHorizontal: 4,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.9)",
                shadowColor: "#7089b0",
                shadowOpacity: 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              },
              a.disabled && { opacity: 0.5 },
              pressed && !a.disabled && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: radius.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.bg,
              }}
            >
              <Icon name={a.icon} size={19} color={t.fg} />
            </View>
            <Text
              style={{ fontSize: 11.5, fontWeight: "700", color: colors.body, textAlign: "center" }}
              numberOfLines={1}
            >
              {a.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
