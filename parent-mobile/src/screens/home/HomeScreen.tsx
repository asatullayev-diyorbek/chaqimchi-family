import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Device, DeviceSummary, getDevices, getSummary } from "../../api/tracking";

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} daq`;
  return `${hours} soat ${mins} daq`;
}

export default function HomeScreen() {
  const [device, setDevice] = useState<Device | null>(null);
  const [summary, setSummary] = useState<DeviceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const devices = await getDevices();
      const linked = devices.find((d) => d.status === "linked") ?? devices[0] ?? null;
      setDevice(linked);
      if (linked) {
        setSummary(await getSummary(linked.id));
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Yuklanmoqda...</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text>Hali bog'langan qurilma yo'q</Text>
      </View>
    );
  }

  const isOnline = summary?.device_status === "online";

  return (
    <ScrollView
      contentContainerStyle={{ padding: 24, gap: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: isOnline ? "#34c759" : "#8e8e93",
          }}
        />
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
          {device.child_name || "Qurilma"} — {isOnline ? "Onlayn" : "Oflayn"}
        </Text>
      </View>

      <View style={{ alignItems: "center", gap: 4 }}>
        <Text style={{ fontSize: 56, fontWeight: "700" }}>
          {formatMinutes(summary?.total_screen_minutes ?? 0)}
        </Text>
        <Text style={{ fontSize: 16, color: "#666" }}>Bugungi ekran vaqti</Text>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>Eng ko'p ishlatilgan</Text>
        {(summary?.top_apps ?? []).slice(0, 4).map((app) => (
          <View
            key={app.app}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "#eee",
              borderRadius: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "#e5e5ea",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text>📱</Text>
            </View>
            <Text style={{ flex: 1 }}>{app.app}</Text>
            <Text style={{ color: "#666" }}>{formatMinutes(app.minutes)}</Text>
          </View>
        ))}
        {(summary?.top_apps ?? []).length === 0 && <Text>Bugun ma'lumot yo'q</Text>}
      </View>

      {error && <Text style={{ color: "red" }}>{error}</Text>}
    </ScrollView>
  );
}
