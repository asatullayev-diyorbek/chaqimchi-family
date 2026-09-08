import React, { useCallback } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { useFamily } from "../../state/family";
import { getSummary } from "../../api/tracking";
import { useQuery } from "../../hooks/useQuery";
import {
  Button,
  DeviceCard,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Muted,
  Screen,
  Text,
} from "../../components";

export default function DevicesScreen({ navigation }: any) {
  const { children, linkedDevices, loading: familyLoading } = useFamily();

  const fetcher = useCallback(async () => {
    const entries = await Promise.all(
      linkedDevices.map(async (d) => {
        const s = await getSummary(d.id).catch(() => null);
        return [d.id, s] as const;
      }),
    );
    return Object.fromEntries(entries);
  }, [linkedDevices.map((d) => d.id).join(",")]);

  const deviceKey = linkedDevices.map((d) => d.id).join(",");
  const { data: summaries, loading, error, refetch, refreshing } = useQuery(fetcher, [deviceKey], {
    enabled: linkedDevices.length > 0,
  });

  if (familyLoading || (loading && linkedDevices.length > 0)) {
    return (
      <Screen>
        <View style={{ gap: 12 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      </Screen>
    );
  }

  if (linkedDevices.length === 0) {
    return (
      <Screen scroll>
        <EmptyState
          icon="device"
          title="Qurilma yo‘q"
          message="Farzand kompyuteriga Spino24 dasturini o‘rnatib, 6 xonali kod bilan ulang."
          action={{ label: "Qurilma ulash", onPress: () => navigation.navigate("PairDevice") }}
        />
      </Screen>
    );
  }

  if (error && !summaries) {
    return (
      <Screen>
        <ErrorState message={error.message} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      {children.map((child) => {
        const own = linkedDevices.filter((d) => d.child_id === child.id);
        if (own.length === 0) return null;
        return (
          <View key={child.id} style={{ gap: 10 }}>
            <Text variant="h3">{child.name}</Text>
            {own.map((d) => {
              const s = summaries?.[d.id];
              return (
                <DeviceCard
                  key={d.id}
                  device={d}
                  online={s?.device_status === "online"}
                  battery={s?.battery_percent ?? null}
                  onPress={() => navigation.navigate("DeviceDetail", { deviceId: d.id })}
                />
              );
            })}
          </View>
        );
      })}

      {linkedDevices.some((d) => !d.child_id) ? (
        <View style={{ gap: 10 }}>
          <Text variant="h3">Farzandga biriktirilmagan</Text>
          {linkedDevices
            .filter((d) => !d.child_id)
            .map((d) => (
              <DeviceCard
                key={d.id}
                device={d}
                online={summaries?.[d.id]?.device_status === "online"}
                battery={summaries?.[d.id]?.battery_percent ?? null}
                onPress={() => navigation.navigate("DeviceDetail", { deviceId: d.id })}
              />
            ))}
        </View>
      ) : null}

      <Button title="Qurilma ulash" icon="plus" variant="secondary" onPress={() => navigation.navigate("PairDevice")} />
      <Muted style={{ textAlign: "center" }}>
        Hozircha faqat Windows kompyuterlar qo‘llab-quvvatlanadi.
      </Muted>
    </Screen>
  );
}
