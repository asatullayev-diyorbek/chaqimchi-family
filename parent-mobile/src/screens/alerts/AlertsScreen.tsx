import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { getDevices } from "../../api/tracking";
import { Alert, getAlerts, markAlertSeen } from "../../api/alerts";
import { Card, colors, Screen, SecondaryButton } from "../../ui";

function describe(alert: Alert): string {
  if (alert.alert_type === "blocked_app_opened") {
    const app = (alert.payload as any)?.app ?? "ilova";
    return `${app} — ruxsat etilmagan, ochilishi cheklandi`;
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
    return <Screen><View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.muted }}>Yuklanmoqda...</Text></View></Screen>;
  }

  if (!deviceId) {
    return <Screen><View style={{ flex: 1, justifyContent: "center" }}><Card><Text style={{ color: colors.text }}>Hali bog‘langan qurilma yo‘q.</Text></Card></View></Screen>;
  }

  return (
    <Screen>
    <View style={{ flex: 1, gap: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View><Text style={{ fontSize: 26, fontWeight: "800", color: colors.text }}>Alertlar</Text><Text style={{ color: colors.muted, marginTop: 3 }}>Muhim holatlar va eslatmalar</Text></View>
      </View>

      <SecondaryButton title="Barchasini ko‘rilgan deb belgilash" onPress={markAllSeen} disabled={!alerts.some((alert) => !alert.seen)} />

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Card
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
              opacity: item.seen ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 20 }}>
              {item.alert_type === "blocked_app_opened" ? "🚫" : "⏰"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700", lineHeight: 20 }}>{describe(item)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{formatTime(item.triggered_at)}</Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Card><Text style={{ color: colors.muted }}>Hozircha bildirishnoma yo‘q.</Text></Card>}
      />

      {error && <Text style={{ color: colors.danger }}>{error}</Text>}
    </View>
    </Screen>
  );
}
