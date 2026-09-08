import React from "react";
import { View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radius, shadow } from "../theme";
import { Icon, IconName } from "./Icon";
import { Text } from "./primitives";

/**
 * Branded gradient panel for the single most important number on a screen
 * (family screen-time today, a child's remaining time, etc.). Used sparingly —
 * one per screen at most.
 */
export function Hero({
  value,
  label,
  hint,
  icon,
  tone = "brand",
  right,
  style,
}: {
  value: string;
  label: string;
  hint?: string;
  icon?: IconName;
  tone?: "brand" | "mint";
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const colorsPair = tone === "mint" ? gradients.mint : gradients.brand;
  return (
    <LinearGradient
      colors={colorsPair as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: radius.xl,
          padding: 20,
          ...shadow.raised,
          shadowColor: colorsPair[0],
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            {icon ? <Icon name={icon} size={15} color="rgba(255,255,255,0.85)" /> : null}
            <Text variant="label" color="rgba(255,255,255,0.9)" style={{ fontSize: 13 }}>
              {label}
            </Text>
          </View>
          <Text style={{ fontSize: 34, lineHeight: 40, fontWeight: "800", color: "#fff" }}>{value}</Text>
          {hint ? (
            <Text variant="caption" color="rgba(255,255,255,0.82)">
              {hint}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </LinearGradient>
  );
}

/** A pill showing change vs. a previous period. */
export function TrendPill({ deltaMinutes }: { deltaMinutes: number }) {
  if (deltaMinutes === 0) return null;
  const up = deltaMinutes > 0;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: up ? colors.warningSoft : colors.mintSoft,
        borderRadius: radius.pill,
        paddingVertical: 3,
        paddingHorizontal: 8,
      }}
    >
      <Icon name={up ? "chevronUp" : "chevronDown"} size={12} color={up ? colors.warning : colors.mintDark} />
      <Text variant="micro" color={up ? colors.warning : colors.mintDark}>
        {Math.abs(Math.round(deltaMinutes))} daq
      </Text>
    </View>
  );
}
