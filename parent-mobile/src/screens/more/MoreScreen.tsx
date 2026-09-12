import React from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { useSession } from "../../state/session";
import { useFamily } from "../../state/family";
import {
  AppHeader,
  Avatar,
  Card,
  ConfirmSheet,
  ListRow,
  Muted,
  Screen,
  Spino24Wordmark,
  Text,
} from "../../components";

export default function MoreScreen({ navigation }: any) {
  const { user, signOut, viaTelegram } = useSession();
  const { children, linkedDevices } = useFamily();
  const [confirmOut, setConfirmOut] = React.useState(false);

  return (
    <Screen scroll>
      <AppHeader title="Yana" />

      <Card
        onPress={() => navigation.navigate("Settings")}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <Avatar name={user?.full_name || user?.email || "S"} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3">{user?.full_name || "Ota-ona"}</Text>
          <Muted>{user?.email || user?.telegram_username || "Hisob"}</Muted>
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ padding: 16, paddingBottom: 4 }}>
          <Text variant="h3">Oila</Text>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow first icon="users" title="Farzandlar" subtitle={`${children.length} ta`} onPress={() => navigation.navigate("Children")} />
          <ListRow icon="device" title="Qurilmalar" subtitle={`${linkedDevices.length} ta ulangan`} onPress={() => navigation.navigate("Devices")} />
          <ListRow icon="qr" title="Qurilma ulash" onPress={() => navigation.navigate("PairDevice")} />
          <ListRow icon="chart" title="Hisobotlar" onPress={() => navigation.navigate("Reports")} />
          <ListRow icon="card" title="Obuna" onPress={() => navigation.navigate("Subscription")} />
          <ListRow icon="sparkle" title="AI tahlil" onPress={() => navigation.navigate("AIInsight")} />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ padding: 16, paddingBottom: 4 }}>
          <Text variant="h3">Sozlamalar</Text>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow first icon="bell" title="Bildirishnomalar" subtitle="Telegram, alert turlari" onPress={() => navigation.navigate("NotificationSettings")} />
          <ListRow icon="settings" title="Hisob sozlamalari" onPress={() => navigation.navigate("Settings")} />
          <ListRow icon="privacy" title="Maxfiylik" onPress={() => navigation.navigate("Privacy")} />
          <ListRow icon="help" title="Yordam" onPress={() => navigation.navigate("Help")} />
        </View>
      </Card>

      {!viaTelegram ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: 16 }}>
            <ListRow first icon="logout" title="Hisobdan chiqish" danger onPress={() => setConfirmOut(true)} />
          </View>
        </Card>
      ) : null}

      <View style={{ alignItems: "center", gap: 4, paddingVertical: 8 }}>
        <Spino24Wordmark size={16} />
        <Muted>Spino24 · Toshkent</Muted>
      </View>

      <ConfirmSheet
        visible={confirmOut}
        onClose={() => setConfirmOut(false)}
        onConfirm={signOut}
        title="Hisobdan chiqasizmi?"
        message="Qayta kirish uchun email va parol yoki Telegram kerak bo‘ladi."
        confirmLabel="Chiqish"
        destructive
      />
    </Screen>
  );
}
