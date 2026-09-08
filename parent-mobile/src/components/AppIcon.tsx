import React from "react";
import { Image, View } from "react-native";
import { radius } from "../theme";
import { appDisplay } from "../lib/appDisplay";
import { Text } from "./primitives";

/**
 * Real app icon (a data:image/png the agent extracted from the exe) when we
 * have one, otherwise a category-tinted tile with the app's first letter.
 * Process names (chrome.exe) are never shown.
 */
export function AppIcon({
  appId,
  appName,
  icon,
  size = 36,
}: {
  appId: string;
  appName?: string | null;
  icon?: string | null;
  size?: number;
}) {
  const d = appDisplay(appId, appName);
  const br = size <= 28 ? radius.sm : radius.md;
  if (icon) {
    return (
      <Image
        source={{ uri: icon }}
        style={{ width: size, height: size, borderRadius: br }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: br,
        backgroundColor: d.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontWeight: "800", color: d.color, fontSize: size * 0.42 }}>{d.initial}</Text>
    </View>
  );
}

export function SiteIcon({
  domain,
  color,
  initial,
  size = 36,
}: {
  domain: string;
  color: string;
  initial: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size <= 28 ? radius.sm : radius.md,
        backgroundColor: `${color}1f`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontWeight: "800", color, fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}
