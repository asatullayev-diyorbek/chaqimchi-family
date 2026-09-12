import React, { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { colors, radius } from "../../theme";
import { formatMinutes, longWeekday, shortWeekday } from "../../lib/format";
import { appDisplay, domainDisplay } from "../../lib/appDisplay";
import { useFamily } from "../../state/family";
import { getSites, getSummary } from "../../api/tracking";
import { useQuery } from "../../hooks/useQuery";
import {
  Card,
  ChildSwitcher,
  EmptyState,
  ErrorState,
  LoadingState,
  Muted,
  Screen,
  StatCard,
  Text,
  WeekBars,
} from "../../components";

export default function ReportsScreen({ navigation }: any) {
  const { childDevices, selectedChild, activeDevice, setDevice } = useFamily();
  // Reports are device-scoped — there is no family-wide report. With several
  // devices and none picked, ask the parent to choose one.
  const deviceId =
    activeDevice?.id ?? (childDevices.length === 1 ? childDevices[0].id : "");
  const needsDevicePick = !deviceId && childDevices.length > 1;
  const [range, setRange] = useState<"week" | "month">("week");

  const fetcher = useCallback(async () => {
    const [summary, sites] = await Promise.all([
      getSummary(deviceId, { range }),
      getSites(deviceId, { range }).catch(() => null),
    ]);
    return { summary, sites };
  }, [deviceId, range]);

  const { data, loading, error, refetch, refreshing } = useQuery(fetcher, [deviceId, range], {
    enabled: Boolean(deviceId),
  });

  const header = (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="label" color={colors.muted}>
          Farzand
        </Text>
        <ChildSwitcher onAddChild={() => navigation.navigate("AddChild")} />
      </View>
      {childDevices.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {childDevices.map((d) => {
            const active = d.id === deviceId;
            return (
              <Pressable
                key={d.id}
                onPress={() => setDevice(d.id)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.blue : colors.border,
                  backgroundColor: active ? colors.blueSoft : colors.surface,
                }}
              >
                <Text variant="micro" color={active ? colors.blue : colors.muted}>
                  {d.child_name || d.platform}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", backgroundColor: colors.chartTrack, borderRadius: radius.md, padding: 3 }}>
        {(["week", "month"] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: radius.sm,
              backgroundColor: range === r ? colors.surface : "transparent",
              alignItems: "center",
            }}
          >
            <Text variant="micro" color={range === r ? colors.blue : colors.muted}>
              {r === "week" ? "Hafta" : "Oy"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (needsDevicePick) {
    return (
      <Screen scroll>
        {header}
        <EmptyState
          icon="device"
          title="Qurilmani tanlang"
          message="Batafsil hisobot bitta qurilma bo‘yicha tuziladi. Yuqoridan qurilmani tanlang."
        />
      </Screen>
    );
  }
  if (!deviceId) {
    return (
      <Screen scroll>
        {header}
        <EmptyState icon="chart" title="Qurilma yo‘q" message="Hisobot uchun farzand qurilmasini ulang." />
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen scroll>
        {header}
        <LoadingState />
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

  const s = data!.summary;
  const days = (s.breakdown ?? []).slice(range === "month" ? -30 : -7);
  const total = days.reduce((t, b) => t + (b.total_minutes || 0), 0);
  const avg = days.length ? Math.round(total / days.length) : 0;
  const busiest = days.reduce<{ date: string; total_minutes: number } | null>(
    (max, b) => (!max || (b.total_minutes || 0) > max.total_minutes ? { date: b.date, total_minutes: b.total_minutes || 0 } : max),
    null,
  );
  const topApp = s.top_apps[0];
  const topSite = data!.sites?.results?.[0];
  const bars = days.map((b) => ({ label: shortWeekday(b.date), minutes: b.total_minutes || 0, date: b.date }));

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      {header}

      <Card style={{ gap: 4 }}>
        <Muted>{selectedChild?.name} · {range === "week" ? "oxirgi 7 kun" : "oxirgi 30 kun"}</Muted>
        <Text variant="display">{formatMinutes(total)}</Text>
        <Muted>Jami ekran vaqti · kuniga o‘rtacha {formatMinutes(avg)}</Muted>
      </Card>

      {bars.length > 0 ? (
        <Card style={{ gap: 12 }}>
          <Text variant="h3">Kunlik taqsimot</Text>
          <WeekBars days={bars} height={range === "month" ? 110 : 130} />
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <StatCard
          icon="calendar"
          iconColor={colors.catPurple}
          iconBg={colors.catPurpleBg}
          label="Eng faol kun"
          value={busiest && busiest.total_minutes > 0 ? longWeekday(busiest.date) : "—"}
          hint={busiest && busiest.total_minutes > 0 ? formatMinutes(busiest.total_minutes) : undefined}
        />
        <StatCard
          icon="app"
          iconColor={colors.blue}
          iconBg={colors.blueSoft}
          label="Eng ko‘p ilova"
          value={topApp ? appDisplay(topApp.app).label : "—"}
          hint={topApp ? formatMinutes(topApp.minutes) : undefined}
        />
      </View>
      {topSite ? (
        <StatCard
          icon="globe"
          iconColor={colors.catTeal}
          iconBg={colors.catTealBg}
          label="Eng ko‘p sayt"
          value={domainDisplay(topSite.domain).label}
          hint={`${topSite.visits} ta tashrif`}
        />
      ) : null}

      <Muted style={{ textAlign: "center" }}>
        Hisobot bitta qurilma bo‘yicha. AI tavsiyalar va oila bo‘yicha umumiy hisobot keyinroq qo‘shiladi.
      </Muted>
    </Screen>
  );
}
