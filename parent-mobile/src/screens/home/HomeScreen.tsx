import React from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { formatMinutes, shortWeekday } from "../../lib/format";
import { appDisplay } from "../../lib/appDisplay";
import { useFamily } from "../../state/family";
import { useHomeData } from "./useHomeData";
import {
  Button,
  Card,
  ChildSwitcher,
  DeviceRow,
  DeviceScopePicker,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Meter,
  Muted,
  QuickActions,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonCard,
  Spino24Wordmark,
  Text,
  WeekBars,
} from "../../components";
import type { QuickAction } from "../../components";

export default function HomeScreen({ navigation }: any) {
  const { setDevice, activeDevice } = useFamily();
  const { child, data, loading, refreshing, error, refresh, hasDevice, deviceCount } = useHomeData();

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

  const { scopeMinutes, scopeLimit, isAllScope, devices, weekBreakdown, weekAverage, currentApp } = data;
  const over = scopeLimit != null && scopeMinutes > scopeLimit;
  const near = scopeLimit != null && !over && scopeMinutes > scopeLimit * 0.85;
  const pct = scopeLimit ? Math.round((scopeMinutes / scopeLimit) * 100) : null;

  const quickActions: QuickAction[] = [
    {
      icon: "clock",
      label: "Limit",
      tone: "blue",
      onPress: () => navigation.navigate("RulesTab"),
    },
    {
      icon: "rules",
      label: "Qoidalar",
      tone: "mint",
      onPress: () => navigation.navigate("RulesTab"),
    },
    {
      icon: "activity",
      label: "Faoliyat",
      tone: "amber",
      onPress: () =>
        navigation.navigate("ActivityTab", {
          screen: "Activity",
          params: activeDevice ? { deviceId: activeDevice.id } : undefined,
        }),
    },
    {
      icon: "chart",
      label: "Hisobot",
      tone: "muted",
      onPress: () => navigation.navigate("Reports"),
    },
  ];

  const bars = weekBreakdown.map((b) => ({
    label: shortWeekday(b.date),
    minutes: b.total_minutes || 0,
    weekend: [0, 6].includes(new Date(`${b.date}T00:00:00`).getDay()),
  }));

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refresh}>
      {header}

      {/* Today screen time */}
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="clock" size={16} color={colors.blue} />
          <Text variant="label" color={colors.muted}>
            Bugungi ekran vaqti
          </Text>
        </View>

        <Text
          variant="display"
          style={{ fontSize: 34, lineHeight: 40 }}
          color={over ? colors.danger : colors.text}
        >
          {formatMinutes(scopeMinutes)}
        </Text>

        {isAllScope ? (
          <Muted>{devices.length} qurilmada jami · limitni har qurilmada alohida ko‘rasiz</Muted>
        ) : scopeLimit ? (
          <>
            <Text variant="body" color={over ? colors.danger : colors.body}>
              {over
                ? `Limitdan ${formatMinutes(scopeMinutes - scopeLimit)} oshdi`
                : `Limit: ${formatMinutes(scopeLimit)}`}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Meter value={scopeMinutes} max={scopeLimit} tone={over ? "danger" : near ? "warn" : "blue"} />
              </View>
              <Text variant="label" color={over ? colors.danger : colors.muted}>
                {pct}%
              </Text>
            </View>
          </>
        ) : (
          <Muted>Limit o‘rnatilmagan</Muted>
        )}

        {currentApp ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mint }} />
            <Muted>Hozir: {appDisplay(currentApp).label}</Muted>
          </View>
        ) : null}
      </Card>

      {/* Quick actions */}
      <QuickActions actions={quickActions} />

      {/* Devices */}
      <View style={{ gap: 10 }}>
        <SectionHeader
          title={`Qurilmalar (${deviceCount})`}
          actionLabel="Boshqarish"
          onAction={() => navigation.navigate("Devices")}
        />
        {deviceCount > 1 ? <DeviceScopePicker /> : null}
        <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
          {devices.map((d, i) => (
            <DeviceRow
              key={d.device.id}
              device={d.device}
              online={d.online}
              todayMinutes={d.todayMinutes}
              selected={activeDevice?.id === d.device.id}
              first={i === 0}
              onPress={() => navigation.navigate("DeviceDetail", { deviceId: d.device.id })}
            />
          ))}
        </Card>
      </View>

      {/* 7-day statistics */}
      {bars.length > 0 ? (
        <Card style={{ gap: 14 }}>
          <SectionHeader
            title="7 kunlik statistika"
            actionLabel="Batafsil"
            onAction={() =>
              navigation.navigate("ActivityTab", {
                screen: "Activity",
                params: activeDevice ? { deviceId: activeDevice.id } : undefined,
              })
            }
          />
          <WeekBars days={bars} showValues showAverage />
          <Muted>
            {isAllScope ? "Eng faol qurilma bo‘yicha · " : ""}
            o‘rtacha {formatMinutes(weekAverage)}
          </Muted>
        </Card>
      ) : null}
    </Screen>
  );
}
