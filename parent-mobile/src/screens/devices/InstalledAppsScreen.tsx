import React from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { formatDate } from "../../lib/format";
import { getInstalledApps, InstalledApp } from "../../api/tracking";
import { useQuery } from "../../hooks/useQuery";
import {
  AppIcon,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Muted,
  Screen,
  SectionHeader,
  Text,
} from "../../components";

function AppRow({ app, removed, first }: { app: InstalledApp; removed?: boolean; first?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 13,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <AppIcon appId={app.name} appName={app.name} icon={app.icon} size={36} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>
          {app.name}
        </Text>
        <Muted numberOfLines={1}>
          {removed ? `O'chirilgan: ${formatDate(app.uninstalled_at!, true)}` : app.publisher || " "}
        </Muted>
      </View>
      <Text variant="label" color={colors.muted}>
        {app.version || "—"}
      </Text>
    </View>
  );
}

export default function InstalledAppsScreen({ route }: any) {
  const { deviceId } = route.params as { deviceId: string };
  const { data: apps, loading, error, refetch, refreshing } = useQuery(
    () => getInstalledApps(deviceId),
    [deviceId],
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <ErrorState message={error.message} onRetry={refetch} />
      </Screen>
    );
  }
  if (!apps || apps.length === 0) {
    return (
      <Screen scroll refreshing={refreshing} onRefresh={refetch}>
        <EmptyState
          icon="package"
          title="Hali ma'lumot yo'q"
          message="Qurilma o'rnatilgan dasturlar ro'yxatini keyingi sinxronizatsiyada yuboradi."
        />
      </Screen>
    );
  }

  const active = apps.filter((a) => !a.uninstalled_at).sort((a, b) => a.name.localeCompare(b.name));
  const removed = apps
    .filter((a) => a.uninstalled_at)
    .sort((a, b) => new Date(b.uninstalled_at!).getTime() - new Date(a.uninstalled_at!).getTime());

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      <Muted>{active.length} ta o'rnatilgan dastur</Muted>

      {active.length > 0 ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: 16 }}>
            {active.map((app, i) => (
              <AppRow key={app.name} app={app} first={i === 0} />
            ))}
          </View>
        </Card>
      ) : null}

      {removed.length > 0 ? (
        <Card padded={false} style={{ gap: 0 }}>
          <View style={{ padding: 16, paddingBottom: 4 }}>
            <SectionHeader icon="trash" title="Oldin o'rnatilgan" />
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            {removed.map((app, i) => (
              <AppRow key={app.name} app={app} removed first={i === 0} />
            ))}
          </View>
        </Card>
      ) : null}

      <Muted style={{ textAlign: "center" }}>
        Faqat asosiy dasturlar ko'rsatiladi — tizim komponentlari va yangilanishlar yashirilgan.
      </Muted>
    </Screen>
  );
}
