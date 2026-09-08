import React from "react";
import { ActivityIndicator, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { Icon, IconName } from "./Icon";
import { Button, Card, Text } from "./primitives";

export function LoadingState({ label = "Yuklanmoqda…" }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 }}>
      <ActivityIndicator color={colors.blue} />
      <Text variant="caption" color={colors.muted}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon = "info",
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 44, paddingHorizontal: 20, gap: 10 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.lg,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.blueSoft,
        }}
      >
        <Icon name={icon} size={22} color={colors.blue} />
      </View>
      <Text variant="h3" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" color={colors.muted} style={{ textAlign: "center", maxWidth: 300 }}>
          {message}
        </Text>
      ) : null}
      {action ? (
        <View style={{ marginTop: 6, alignSelf: "stretch", maxWidth: 280 }}>
          <Button title={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="alert"
      title="Ma’lumot yuklanmadi"
      message={message || "Iltimos, birozdan so‘ng qayta urinib ko‘ring."}
      action={onRetry ? { label: "Qayta urinish", onPress: onRetry } : undefined}
    />
  );
}

export function OfflineBanner({ lastSync }: { lastSync?: string | null }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: colors.warningSoft,
        borderRadius: radius.md,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Icon name="wifiOff" size={16} color={colors.warning} />
      <Text variant="caption" color={colors.body} style={{ flex: 1 }}>
        Qurilma oflayn.{lastSync ? ` Oxirgi ma’lumot: ${lastSync}.` : ""}
      </Text>
    </View>
  );
}

export function SyncStatus({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name="refresh" size={12} color={colors.faint} />
      <Text variant="micro" color={colors.faint}>
        {text}
      </Text>
    </View>
  );
}

/**
 * A feature that is real in the product roadmap but not wired to the backend
 * yet. Never fake it — show this card so a parent can tell what's live.
 */
export function ComingSoonCard({
  icon,
  title,
  message,
  tag = "Rejalashtirilgan",
}: {
  icon: IconName;
  title: string;
  message: string;
  tag?: string;
}) {
  return (
    <Card style={{ gap: 8, opacity: 0.9 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceSunken,
          }}
        >
          <Icon name={icon} size={18} color={colors.muted} />
        </View>
        <Text variant="h3" style={{ flex: 1 }}>
          {title}
        </Text>
        <View
          style={{
            backgroundColor: colors.brandOrangeSoft,
            borderRadius: radius.pill,
            paddingVertical: 3,
            paddingHorizontal: 9,
          }}
        >
          <Text variant="micro" color={colors.brandOrange}>
            {tag}
          </Text>
        </View>
      </View>
      <Text variant="caption" color={colors.muted} style={{ marginLeft: spacing.xxl + 4 }}>
        {message}
      </Text>
    </Card>
  );
}
