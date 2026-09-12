import React from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { getInstalledApps } from "../../api/tracking";
import { useQuery } from "../../hooks/useQuery";
import { Card, EmptyState, ErrorState, ListRow, LoadingState, Muted, Screen, Text } from "../../components";

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

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      <Muted>{apps.length} ta dastur</Muted>
      <Card padded={false}>
        <View style={{ paddingHorizontal: 16 }}>
          {apps.map((app, i) => (
            <ListRow
              key={app.name}
              first={i === 0}
              icon="package"
              title={app.name}
              subtitle={app.publisher || undefined}
              right={
                <Text variant="label" color={colors.muted}>
                  {app.version || "—"}
                </Text>
              }
            />
          ))}
        </View>
      </Card>
      <Muted style={{ textAlign: "center" }}>
        Faqat asosiy dasturlar ko'rsatiladi — tizim komponentlari va yangilanishlar yashirilgan.
      </Muted>
    </Screen>
  );
}
