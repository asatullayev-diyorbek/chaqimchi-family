import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { colors, radius } from "../../theme";
import { formatDate } from "../../lib/format";
import { appDisplay } from "../../lib/appDisplay";
import { markAlertSeen } from "../../api/alerts";
import { useFamily } from "../../state/family";
import { describeAlert, Button, Card, Icon, Muted, Screen, Text } from "../../components";

const DETAIL: Record<string, { icon: any; color: string; bg: string; body: string }> = {
  limit_reached: {
    icon: "clock",
    color: colors.warning,
    bg: colors.warningSoft,
    body: "Farzandingiz bugungi ekran vaqti limitiga yetdi. Qurilmada ekran bloklandi.",
  },
  blocked_app_opened: {
    icon: "shieldOff",
    color: colors.blue,
    bg: colors.blueSoft,
    body: "Cheklangan ilovani ochishga urinish bo‘ldi. Ilova ishga tushmadi.",
  },
  settings_panel_access: {
    icon: "user",
    color: colors.mint,
    bg: colors.mintSoft,
    body: "Qurilmada Spino24’ning «Kattalar uchun» paneli ochildi. Agar bu siz bo‘lmasangiz, parolni tekshiring.",
  },
};

export default function AlertDetailScreen({ route, navigation }: any) {
  const { alert, childName } = route.params;
  const { linkedDevices, setChild, devices } = useFamily();
  const [seen, setSeen] = useState(alert.seen);

  useEffect(() => {
    if (!alert.seen) markAlertSeen(alert.id).then(() => setSeen(true)).catch(() => undefined);
  }, [alert.id, alert.seen]);

  const meta = DETAIL[alert.alert_type] ?? DETAIL.limit_reached;
  const device = devices.find((d) => d.id === alert.device);

  const openActivity = () => {
    if (device?.child_id) setChild(device.child_id);
    navigation.navigate("ActivityTab", {
      screen: "Activity",
      params: { deviceId: alert.device },
    });
  };

  return (
    <Screen scroll>
      <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: radius.lg,
            backgroundColor: meta.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={meta.icon} size={26} color={meta.color} />
        </View>
        <Text variant="h2" style={{ textAlign: "center" }}>
          {describeAlert(alert)}
        </Text>
        <Muted>
          {childName ? `${childName} · ` : ""}
          {formatDate(alert.triggered_at, true)}
        </Muted>
      </Card>

      <Card style={{ gap: 8 }}>
        <Text variant="body" color={colors.body}>
          {meta.body}
        </Text>
      </Card>

      <Button title="Faoliyatni ko‘rish" icon="activity" onPress={openActivity} />
      {alert.alert_type === "limit_reached" || alert.alert_type === "blocked_app_opened" ? (
        <Button
          title="Qoidalarni sozlash"
          variant="secondary"
          icon="rules"
          onPress={() => {
            if (device?.child_id) setChild(device.child_id);
            navigation.navigate("RulesTab");
          }}
        />
      ) : null}
    </Screen>
  );
}
