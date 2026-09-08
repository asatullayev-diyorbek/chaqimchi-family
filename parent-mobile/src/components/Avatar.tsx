import React from "react";
import { Image, View } from "react-native";
import { API_BASE_URL } from "../api/client";
import { colors, FAMILY_COLORS } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./primitives";

function hueFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FAMILY_COLORS[h % FAMILY_COLORS.length];
}

function resolvePhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

export function Avatar({
  name,
  photoUrl,
  seed,
  size = 44,
}: {
  name: string;
  photoUrl?: string | null;
  seed?: string;
  size?: number;
}) {
  const resolved = resolvePhoto(photoUrl);
  const color = hueFor(seed ?? name ?? "?");
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: `${color}22`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {resolved ? (
        <Image source={{ uri: resolved }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize: size * 0.4, fontWeight: "800", color }}>{initial}</Text>
      )}
    </View>
  );
}

export function PlatformBadge({
  platform,
  size = 16,
}: {
  platform: "windows" | "android" | "ios";
  size?: number;
}) {
  const map = {
    windows: { icon: "laptop" as const, label: "Windows" },
    android: { icon: "phone" as const, label: "Android" },
    ios: { icon: "phone" as const, label: "iPhone" },
  };
  const m = map[platform];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon name={m.icon} size={size} color={colors.muted} />
      <Text variant="caption" color={colors.muted}>
        {m.label}
      </Text>
    </View>
  );
}

export function StatusDot({ online, size = 9 }: { online: boolean; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: online ? colors.mint : colors.faint,
      }}
    />
  );
}
