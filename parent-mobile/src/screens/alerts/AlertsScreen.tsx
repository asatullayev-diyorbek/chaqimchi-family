import React, { useCallback, useEffect, useState } from "react";
import { Button, FlatList, RefreshControl, Text, View } from "react-native";
import { getDevices } from "../../api/tracking";
import { Alert, getAlerts, markAlertSeen } from "../../api/alerts";

function describe(alert: Alert): string {
  if (alert.alert_type === "blocked_app_opened") {
    const app = (alert.payload as any)?.app ?? "ilova";
    return `${app} ochishga urinildi`;
  }
  return "Bugungi ekran vaqti limiti to'ldi";
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

export default function AlertsScreen() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const devices = await getDevices();
      const linked = devices.find((d) => d.status === "linked");
      if (!linked) return;
      setDeviceId(linked.id);
      setAlerts(await getAlerts(linked.id));
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

  async function markAllSeen() {
    try {
      await Promise.all(alerts.filter((a) => !a.seen).map((a) => markAlertSeen(a.id)));
      setAlerts((prev) => prev.map((a) => ({ ...a, seen: true })));
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Yuklanmoqda...</Text>
      </View>
    );
  }

  if (!deviceId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text>Hali bog'langan qurilma yo'q</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 20, fontWeight: "600" }}>Bildirishnomalar</Text>
        <Button title="Barchasini ko'rilgan deb belgilash" onPress={markAllSeen} />
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "#eee",
              borderRadius: 12,
              marginBottom: 8,
              opacity: item.seen ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 20 }}>
              {item.alert_type === "blocked_app_opened" ? "🚫" : "⏰"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text>{describe(item)}</Text>
              <Text style={{ color: "#666", fontSize: 12 }}>{formatTime(item.triggered_at)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: "#666" }}>Hozircha bildirishnoma yo'q</Text>}
      />

      {error && <Text style={{ color: "red" }}>{error}</Text>}
    </View>
  );
}
