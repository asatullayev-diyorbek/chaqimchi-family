import React, { useCallback, useEffect, useState } from "react";
import { Button, FlatList, Text, TextInput, View } from "react-native";
import { getDevices } from "../../api/tracking";
import { Rule, createRule, deleteRule, getRules } from "../../api/rules";

export default function RulesScreen() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [limitHours, setLimitHours] = useState("");
  const [limitMinutes, setLimitMinutes] = useState("");
  const [newApp, setNewApp] = useState("");

  const dailyLimitRule = rules.find((r) => r.rule_type === "daily_limit_minutes");
  const blockedAppRules = rules.filter((r) => r.rule_type === "blocked_app");

  const load = useCallback(async () => {
    try {
      setError(null);
      const devices = await getDevices();
      const linked = devices.find((d) => d.status === "linked");
      if (!linked) return;
      setDeviceId(linked.id);
      const fetchedRules = await getRules(linked.id);
      setRules(fetchedRules);
      const limitRule = fetchedRules.find((r) => r.rule_type === "daily_limit_minutes");
      if (limitRule && "minutes" in limitRule.value) {
        setLimitHours(String(Math.floor(limitRule.value.minutes / 60)));
        setLimitMinutes(String(limitRule.value.minutes % 60));
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function applyDailyLimit(hoursStr: string, minutesStr: string) {
    if (!deviceId) return;
    const hours = parseInt(hoursStr, 10) || 0;
    const minutes = parseInt(minutesStr, 10) || 0;
    const totalMinutes = hours * 60 + minutes;

    try {
      if (dailyLimitRule) {
        await deleteRule(dailyLimitRule.id);
      }
      if (totalMinutes > 0) {
        const rule = await createRule(deviceId, "daily_limit_minutes", { minutes: totalMinutes });
        setRules((prev) => [...prev.filter((r) => r.rule_type !== "daily_limit_minutes"), rule]);
      } else {
        setRules((prev) => prev.filter((r) => r.rule_type !== "daily_limit_minutes"));
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function addBlockedApp() {
    if (!deviceId || !newApp.trim()) return;
    try {
      const rule = await createRule(deviceId, "blocked_app", { app: newApp.trim() });
      setRules((prev) => [...prev, rule]);
      setNewApp("");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function removeBlockedApp(rule: Rule) {
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
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
    <View style={{ flex: 1, padding: 24, gap: 24 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>Kunlik ekran vaqti limiti</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            placeholder="soat"
            keyboardType="number-pad"
            value={limitHours}
            onChangeText={setLimitHours}
            onBlur={() => applyDailyLimit(limitHours, limitMinutes)}
            style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, width: 70 }}
          />
          <Text>soat</Text>
          <TextInput
            placeholder="daqiqa"
            keyboardType="number-pad"
            value={limitMinutes}
            onChangeText={setLimitMinutes}
            onBlur={() => applyDailyLimit(limitHours, limitMinutes)}
            style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, width: 70 }}
          />
          <Text>daqiqa</Text>
        </View>
        <Text style={{ color: "#666", fontSize: 12 }}>0 qoldirsangiz, limit o'chiriladi</Text>
      </View>

      <View style={{ gap: 8, flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>Ruxsat etilmagan ilovalar</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            placeholder="masalan: steam.exe"
            autoCapitalize="none"
            value={newApp}
            onChangeText={setNewApp}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
            }}
          />
          <Button title="Qo'shish" onPress={addBlockedApp} />
        </View>
        <FlatList
          data={blockedAppRules}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 12,
                marginTop: 8,
              }}
            >
              <Text>{"app" in item.value ? item.value.app : ""}</Text>
              <Button title="O'chirish" onPress={() => removeBlockedApp(item)} />
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: "#666" }}>Hali ruxsat etilmagan ilova yo'q</Text>}
        />
      </View>

      {error && <Text style={{ color: "red" }}>{error}</Text>}
    </View>
  );
}
