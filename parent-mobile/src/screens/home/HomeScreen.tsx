import React from "react";
import { View } from "react-native";
import { colors, radius } from "../../theme";
import { formatMinutes, shortWeekday } from "../../lib/format";
import { appDisplay } from "../../lib/appDisplay";
import { useHomeData } from "./useHomeData";
import {
  Button,
  Card,
  ChildSwitcher,
  DeviceRow,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Meter,
  Muted,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonCard,
  Spino24Mascot,
  Spino24Wordmark,
  Text,
  WeekBars,
} from "../../components";

export default function HomeScreen({ navigation }: any) {
  const { child, data, loading, refreshing, error, refresh, hasDevice, deviceCount, scopeDevice } = useHomeData();

  const unseen = data?.unseenAlerts ?? 0;
  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <Spino24Wordmark size={18} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        <View>
          <IconButton
            name="bell"
            onPress={() => navigation.navigate("AlertsTab")}
            accessibilityLabel="Xabarlar"
            color={colors.body}
          />
          {unseen > 0 ? (
            <View
              style={{
                position: "absolute",
                top: 1,
                right: 1,
                minWidth: 15,
                height: 15,
                paddingHorizontal: 3,
                borderRadius: 8,
                backgroundColor: colors.danger,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>
                {unseen > 9 ? "9+" : unseen}
              </Text>
            </View>
          ) : null}
        </View>
        <ChildSwitcher onAddChild={() => navigation.navigate("AddChild")} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen scroll>
        {header}
        <Skeleton height={148} radius={22} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={80} radius={18} style={{ flex: 1 }} />
          ))}
        </View>
        <SkeletonCard lines={3} />
      </Screen>
    );
  }

  if (!child) {
    return (
      <Screen scroll refreshing={refreshing} onRefresh={refresh}>
        {header}
        <EmptyState
          icon="users"
          title="Oilangizni qo‘shing"
          message="Boshlash uchun birinchi farzandingizni qo‘shing, so‘ng uning qurilmasini ulaysiz."
          action={{ label: "Farzand qo‘shish", onPress: () => navigation.navigate("AddChild") }}
        />
      </Screen>
    );
  }

  if (!hasDevice) {
    return (
      <Screen scroll refreshing={refreshing} onRefresh={refresh}>
        {header}
        <Card tone="hero" style={{ gap: 10 }}>
          <Text variant="h3">{child.name} uchun qurilma ulanmagan</Text>
          <Text variant="body" color={colors.body}>
            Farzand kompyuteridagi Spino24 dasturi ko‘rsatgan 6 xonali kodni kiriting.
          </Text>
          <Button title="Qurilma ulash" onPress={() => navigation.navigate("PairDevice", { childId: child.id })} />
        </Card>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen scroll>
        {header}
        <ErrorState message={error} onRetry={refresh} />
      </Screen>
    );
  }
  if (!data) return null;

  const { scopeMinutes, scopeLimit, isAllScope, devices, weekBreakdown, weekAverage, lastApp } = data;
  const scopeOnline = scopeDevice
    ? devices.find((d) => d.device.id === scopeDevice.id)?.online
    : devices.some((d) => d.online);
  const over = scopeLimit != null && scopeMinutes > scopeLimit;
  const near = scopeLimit != null && !over && scopeMinutes > scopeLimit * 0.85;
  const pct = scopeLimit ? Math.round((scopeMinutes / scopeLimit) * 100) : null;

  const bars = weekBreakdown.map((b) => ({
    label: shortWeekday(b.date),
    minutes: b.total_minutes || 0,
    weekend: [0, 6].includes(new Date(`${b.date}T00:00:00`).getDay()),
    date: b.date,
  }));

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refresh}>
      {header}

      {/* Today screen time */}
      <Card style={{ gap: 10, overflow: "hidden" }}>
        <Spino24Mascot width={82} style={{ position: "absolute", top: 6, right: 2 }} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 84 }}>
          <Icon name="clock" size={16} color={colors.blue} />
          <Text variant="label" color={colors.muted}>
            Bugungi ekran vaqti
          </Text>
        </View>

        <Text
          style={{ fontSize: 27, lineHeight: 33, fontWeight: "800" }}
          color={over ? colors.danger : colors.text}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {formatMinutes(scopeMinutes)}
        </Text>

        {isAllScope ? (
          <Muted>{devices.length} qurilmada jami</Muted>
        ) : scopeLimit ? (
          <Text variant="body" color={over ? colors.danger : colors.body}>
            {over
              ? `Limitdan ${formatMinutes(scopeMinutes - scopeLimit)} oshdi`
              : `Limit: ${formatMinutes(scopeLimit)}`}
          </Text>
        ) : (
          <Muted>Limit o‘rnatilmagan</Muted>
        )}

        {!isAllScope && scopeLimit ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Meter value={scopeMinutes} max={scopeLimit} tone={over ? "danger" : near ? "warn" : "blue"} height={10} />
            </View>
            <Text variant="label" color={over ? colors.danger : colors.muted}>
              {pct}%
            </Text>
          </View>
        ) : null}

        {lastApp ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: scopeOnline ? colors.mint : colors.faint,
              }}
            />
            <Muted>
              {scopeOnline ? "So‘nggi ilova" : "Oxirgi ishlatilgan"}: {appDisplay(lastApp).label}
            </Muted>
          </View>
        ) : null}
      </Card>

      {/* Devices */}
      <Card style={{ gap: 12 }}>
        <SectionHeader icon="device" title={`Qurilmalar (${deviceCount})`} />
        <View style={{ gap: 10 }}>
          {devices.map((d) => (
            <DeviceRow
              key={d.device.id}
              device={d.device}
              online={d.online}
              todayMinutes={d.todayMinutes}
              battery={d.battery}
              childName={child.name}
              onPress={() => navigation.navigate("DeviceDetail", { deviceId: d.device.id })}
            />
          ))}
        </View>
      </Card>

      {/* 7-day statistics */}
      {bars.length > 0 ? (
        <Card style={{ gap: 14 }}>
          <SectionHeader
            icon="activity"
            title="7 kunlik statistika"
            actionLabel="Batafsil"
            onAction={() =>
              navigation.navigate("ActivityTab", {
                screen: "Activity",
                params: scopeDevice ? { deviceId: scopeDevice.id } : undefined,
              })
            }
          />
          <WeekBars days={bars} showAverage />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radius.md,
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <Icon name="activity" size={14} color={colors.muted} />
            <Muted>
              {isAllScope ? "Barcha qurilmalar · " : ""}O‘rtacha: {formatMinutes(weekAverage)}
            </Muted>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
