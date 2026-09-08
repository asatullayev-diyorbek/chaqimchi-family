import React, { useCallback } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { childAge, formatMinutes, formatMinutesShort, relativeTime, shortWeekday } from "../../lib/format";
import { useFamily } from "../../state/family";
import { getRules, getDailyLimitMinutes } from "../../api/rules";
import { DeviceSummary, getSummary } from "../../api/tracking";
import { useQuery } from "../../hooks/useQuery";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Muted,
  RingProgress,
  Screen,
  SectionHeader,
  SkeletonCard,
  StatusDot,
  Text,
  WeekBars,
} from "../../components";

export default function ChildOverviewScreen({ route, navigation }: any) {
  const { childId } = route.params as { childId: string };
  const { children, linkedDevices, setChild } = useFamily();
  const child = children.find((c) => c.id === childId) ?? null;
  const devices = linkedDevices.filter((d) => d.child_id === childId);

  const fetcher = useCallback(async () => {
    const perDevice = await Promise.all(
      devices.map(async (d) => {
        const [day, week, rules] = await Promise.all([
          getSummary(d.id),
          getSummary(d.id, { range: "week" }).catch(() => null),
          getRules(d.id).catch(() => []),
        ]);
        return { deviceId: d.id, day, week, limit: getDailyLimitMinutes(rules) };
      }),
    );
    return perDevice;
  }, [devices.map((d) => d.id).join(",")]);

  const deviceKey = devices.map((d) => d.id).join(",");
  const { data, loading, error, refetch, refreshing } = useQuery(fetcher, [childId, deviceKey], {
    enabled: devices.length > 0,
  });

  if (!child) {
    return (
      <Screen>
        <ErrorState message="Farzand topilmadi" onRetry={() => navigation.goBack()} />
      </Screen>
    );
  }

  const age = childAge(child.birth_date);

  const header = (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <Avatar name={child.name} photoUrl={child.photo_url} seed={child.id} size={52} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="h2">{child.name}</Text>
        <Muted>
          {age != null ? `${age} yosh · ` : ""}
          {devices.length} ta qurilma
        </Muted>
      </View>
    </Card>
  );

  if (devices.length === 0) {
    return (
      <Screen scroll>
        {header}
        <EmptyState
          icon="device"
          title="Qurilma ulanmagan"
          message={`${child.name} uchun hali qurilma ulanmagan.`}
          action={{ label: "Qurilma ulash", onPress: () => navigation.navigate("PairDevice", { childId }) }}
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen scroll>
        {header}
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen scroll>
        {header}
        <ErrorState message={error.message} onRetry={refetch} />
      </Screen>
    );
  }

  const rows = data ?? [];

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      {header}

      {rows.length > 1 ? <SectionHeader title="Qurilmalar" /> : null}

      {rows.map(({ deviceId, day, week, limit }) => {
        const device = devices.find((d) => d.id === deviceId)!;
        const over = limit != null && day.total_screen_minutes > limit;
        const weekDays = (week?.breakdown ?? []).slice(-7).map((b) => ({
          label: shortWeekday(b.date),
          minutes: b.total_minutes || 0,
          weekend: [0, 6].includes(new Date(`${b.date}T00:00:00`).getDay()),
        }));
        return (
          <Card key={deviceId} style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="h3">{device.child_name || (device.platform === "windows" ? "Kompyuter" : "Qurilma")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <StatusDot online={day.device_status === "online"} />
                <Muted>
                  {day.device_status === "online" ? "Onlayn" : relativeTime(day.last_sync)}
                </Muted>
              </View>
            </View>

            <View style={{ alignItems: "center", gap: 8 }}>
              <RingProgress
                size={156}
                stroke={13}
                value={day.total_screen_minutes}
                max={limit}
                centerTop={formatMinutesShort(day.total_screen_minutes)}
                centerBottom={
                  limit
                    ? over
                      ? `${formatMinutesShort(day.total_screen_minutes - limit)} oshdi`
                      : `${formatMinutesShort(limit - day.total_screen_minutes)} qoldi`
                    : "bugun"
                }
              />
              <Text variant="body" color={colors.body}>
                {formatMinutes(day.total_screen_minutes)}
                {limit ? ` · limit ${formatMinutes(limit)}` : ""}
              </Text>
            </View>

            {weekDays.length > 0 ? <WeekBars days={weekDays} height={104} /> : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                title="Faoliyat"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  setChild(childId);
                  navigation.navigate("ActivityTab", { screen: "Activity", params: { deviceId } });
                }}
              />
              <Button
                title="Qurilma"
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => navigation.navigate("DeviceDetail", { deviceId })}
              />
            </View>
          </Card>
        );
      })}

      <Button
        title="Qoidalarni sozlash"
        icon="rules"
        onPress={() => {
          setChild(childId);
          navigation.navigate("RulesTab");
        }}
      />
    </Screen>
  );
}
