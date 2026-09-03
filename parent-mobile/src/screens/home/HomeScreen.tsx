import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { Device, DeviceSummary, getDevices, getSummary } from "../../api/tracking";
import { Card, colors, PrimaryButton, Screen, SplitBar, WeekBars } from "../../ui";

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours === 0 ? `${mins} min` : `${hours} soat ${mins} min`;
}

const WD = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

function weekDays(breakdown: { date: string; total_minutes: number }[] | undefined) {
  return (breakdown ?? []).slice(-7).map((b) => {
    const d = new Date(b.date + "T00:00:00");
    return { label: Number.isNaN(d.getTime()) ? "" : WD[d.getDay()], minutes: b.total_minutes || 0 };
  });
}

export default function HomeScreen({ navigation }: any) {
  const [device, setDevice] = useState<Device | null>(null);
  const [summary, setSummary] = useState<DeviceSummary | null>(null);
  const [week, setWeek] = useState<DeviceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const devices = await getDevices();
      const linked = devices.find((d) => d.status === "linked") ?? devices[0] ?? null;
      setDevice(linked);
      if (!linked) {
        setSummary(null);
        setWeek(null);
        return;
      }
      const [day, wk] = await Promise.all([
        getSummary(linked.id),
        getSummary(linked.id, { range: "week" }).catch(() => null),
      ]);
      setSummary(day);
      setWeek(wk);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  if (loading) return <Screen><View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.muted }}>Yuklanmoqda...</Text></View></Screen>;

  if (!device) {
    return <Screen><View style={{ flex: 1, justifyContent: "center" }}><Card style={{ gap: 12 }}><Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>Qurilma ulanmagan</Text><Text style={{ color: colors.muted, lineHeight: 22 }}>Child ilovadagi olti xonali kodni skanerlang yoki qo‘lda kiriting.</Text><PrimaryButton title="Qurilma qo‘shish" onPress={() => navigation.navigate("QRScan")} /></Card></View></Screen>;
  }

  const isOnline = summary?.device_status === "online";
  const topApps = (summary?.top_apps ?? []).slice(0, 4);
  const days = weekDays(week?.breakdown);
  const weekAvg = days.length ? Math.round(days.reduce((s, d) => s + d.minutes, 0) / days.length) : 0;
  const split = (summary?.top_apps ?? []).slice(0, 4).map((a) => ({ label: a.app.replace(/\.exe$/i, ""), minutes: a.minutes }));
  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 27, fontWeight: "800" }}>Bosh sahifa</Text>
          <Text style={{ color: colors.muted, fontSize: 15 }}>Bugungi qisqa ko‘rinish</Text>
        </View>
        <Card style={{ gap: 14, backgroundColor: "#f8fbff" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isOnline ? colors.mint : "#aab4c2" }} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{device.child_name || "Qurilma"} · {isOnline ? "Onlayn" : "Oflayn"}</Text>
          </View>
          <View style={{ alignItems: "center", paddingVertical: 9 }}>
            <Text style={{ fontSize: 36, lineHeight: 44, fontWeight: "800", color: colors.text }}>{formatMinutes(summary?.total_screen_minutes ?? 0)}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>Bugungi ekran vaqti</Text>
          </View>
        </Card>
        {days.length > 0 && (
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>7 kunlik statistika</Text>
              <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>o‘rtacha {formatMinutes(weekAvg)}</Text>
            </View>
            <WeekBars days={days} />
          </Card>
        )}
        {split.length > 0 && (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Ilovalar taqsimoti</Text>
            <SplitBar items={split} />
          </Card>
        )}
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Eng ko‘p ishlatilgan</Text><Text style={{ color: colors.blue, fontWeight: "700" }}>Bugun</Text></View>
          {topApps.map((app, index) => <View key={app.app} style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderColor: "#edf0f5" }}><View style={{ width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: index % 2 ? "#e8f0ff" : "#d8f5ee" }}><Text style={{ color: index % 2 ? colors.blue : colors.mint, fontWeight: "800" }}>{app.app[0]?.toUpperCase()}</Text></View><Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontWeight: "700" }}>{app.app}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{formatMinutes(app.minutes)}</Text></View>)}
          {topApps.length === 0 && <Text style={{ color: colors.muted }}>Bugun ma’lumot yo‘q.</Text>}
        </Card>
        <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><PrimaryButton title="Qoidalar" onPress={() => navigation.navigate("Rules")} /></View><View style={{ flex: 1 }}><PrimaryButton title="Alertlar" onPress={() => navigation.navigate("Alerts")} /></View></View>
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
      </View>
    </Screen>
  );
}
