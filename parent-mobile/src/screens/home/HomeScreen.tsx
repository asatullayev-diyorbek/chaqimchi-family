import React from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { formatMinutes, shortWeekday } from "../../lib/format";
import { useHomeData } from "./useHomeData";
import {
  AppHeader,
  Button,
  Card,
  ChildCard,
  EmptyState,
  ErrorState,
  Hero,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonCard,
  Text,
  WeekBars,
} from "../../components";

export default function HomeScreen({ navigation }: any) {
  const { glances, loading, refreshing, error, refresh, hasChildren, hasAnyDevice } = useHomeData();

  const header = (
    <AppHeader
      brand
      subtitle="Bugungi qisqa ko‘rinish"
      action={{ icon: "bell", onPress: () => navigation.navigate("AlertsTab"), label: "Ogohlantirishlar" }}
    />
  );

  if (loading) {
    return (
      <Screen scroll>
        {header}
        <Skeleton height={104} radius={22} />
        <SkeletonCard />
        <SkeletonCard lines={2} />
      </Screen>
    );
  }

  if (error && !glances) {
    return (
      <Screen>
        {header}
        <ErrorState message={error} onRetry={refresh} />
      </Screen>
    );
  }

  if (!hasChildren) {
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

  const list = glances ?? [];
  const totalUnseen = list.reduce((t, g) => t + g.unseenAlerts, 0);
  const withDevice = list.filter((g) => g.hasDevice);
  const activeDevices = list.filter((g) => g.online).length;
  const familyToday = list.reduce((t, g) => t + g.todayMinutes, 0);

  const single = list.length === 1 ? list[0] : null;
  const trend =
    single && single.weekBreakdown.length
      ? single.weekBreakdown.map((b) => ({
          label: shortWeekday(b.date),
          minutes: b.total_minutes || 0,
          weekend: [0, 6].includes(new Date(`${b.date}T00:00:00`).getDay()),
        }))
      : null;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refresh}>
      {header}

      {!hasAnyDevice ? (
        <Card tone="hero" style={{ gap: 10 }}>
          <Text variant="h3">Qurilma hali ulanmagan</Text>
          <Text variant="body" color={colors.body}>
            Farzand kompyuteridagi Spino24 dasturi ko‘rsatgan 6 xonali kodni kiriting.
          </Text>
          <Button title="Qurilma ulash" onPress={() => navigation.navigate("PairDevice")} />
        </Card>
      ) : (
        <Hero
          icon="clock"
          label="Bugungi ekran vaqti"
          value={formatMinutes(familyToday)}
          hint={
            withDevice.length > 1
              ? `${withDevice.length} farzand · ${activeDevices} ta onlayn`
              : activeDevices
                ? "Qurilma onlayn"
                : "Qurilma oflayn"
          }
          right={
            withDevice.length > 1 ? (
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff" }}>
                  {activeDevices}/{withDevice.length}
                </Text>
                <Text variant="micro" color="rgba(255,255,255,0.8)">
                  onlayn
                </Text>
              </View>
            ) : undefined
          }
        />
      )}

      <View style={{ gap: 10 }}>
        {list.length > 1 ? <SectionHeader title="Farzandlar" /> : null}
        {list.map((g) => (
          <ChildCard
            key={g.childId}
            name={g.name}
            photoUrl={g.photoUrl}
            seed={g.childId}
            online={g.online}
            todayMinutes={g.todayMinutes}
            limitMinutes={g.limitMinutes}
            hasDevice={g.hasDevice}
            currentApp={g.currentApp}
            unseenAlerts={g.unseenAlerts}
            weekMinutes={g.weekBreakdown.map((b) => b.total_minutes || 0)}
            onPress={() =>
              g.hasDevice
                ? navigation.navigate("ChildOverview", { childId: g.childId })
                : navigation.navigate("PairDevice", { childId: g.childId })
            }
          />
        ))}
      </View>

      {trend ? (
        <Card style={{ gap: 14 }}>
          <SectionHeader
            title="7 kunlik statistika"
            actionLabel="Batafsil"
            onAction={() => navigation.navigate("ActivityTab")}
          />
          <WeekBars days={trend} showValues />
          <Text variant="micro" color={colors.faint}>
            Eng faol qurilma bo‘yicha · yashil chiziq — o‘rtacha
          </Text>
        </Card>
      ) : (
        <Button
          title="Faoliyatni ko‘rish"
          variant="secondary"
          icon="activity"
          onPress={() => navigation.navigate("ActivityTab")}
        />
      )}

      {totalUnseen > 0 ? (
        <Card
          onPress={() => navigation.navigate("AlertsTab")}
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: colors.warningSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="alert" size={17} color={colors.warning} />
          </View>
          <Text variant="label" style={{ flex: 1 }}>
            {totalUnseen} ta yangi ogohlantirish
          </Text>
          <Icon name="chevronRight" size={18} color={colors.faint} />
        </Card>
      ) : null}
    </Screen>
  );
}
