import React, { useState } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { useSession } from "../../state/session";
import { Button, Card, Icon, Screen, Spino24Logo, Spino24Mascot, Text } from "../../components";

const POINTS = [
  { icon: "activity" as const, title: "Kunlik ko‘rinish", text: "Ekran vaqti, ilovalar va saytlar — bir qarashda." },
  { icon: "shield" as const, title: "Oddiy qoidalar", text: "Limit qo‘ying, ilovalarni cheklang, tinch soatlarni belgilang." },
  { icon: "eyeOff" as const, title: "Kuzatuv emas, tushuntirish", text: "Xabarlar, parollar yoki skrinshotlar yig‘ilmaydi." },
];

export default function WelcomeScreen({ navigation }: any) {
  const { viaTelegram, retryTelegram } = useSession();
  const [retrying, setRetrying] = useState(false);

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: 24, paddingVertical: 20 }}>
        <View style={{ alignItems: "center", gap: 14 }}>
          <Spino24Mascot width={140} />
          <Spino24Logo width={220} />
          <Text variant="bodyLg" color={colors.muted} style={{ textAlign: "center", maxWidth: 300 }}>
            Farzandingizning raqamli kunini xotirjam kuzating va boshqaring.
          </Text>
        </View>

        <Card style={{ gap: 4 }}>
          {POINTS.map((p, i) => (
            <View
              key={p.title}
              style={{
                flexDirection: "row",
                gap: 12,
                paddingVertical: 12,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: colors.brandGreenSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={p.icon} size={18} color={colors.brandGreen} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">{p.title}</Text>
                <Text variant="caption" color={colors.muted}>
                  {p.text}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {viaTelegram ? (
          <View style={{ gap: 10 }}>
            <Text variant="caption" color={colors.muted} style={{ textAlign: "center" }}>
              Telegram orqali avtomatik kirishda muammo bo‘ldi.
            </Text>
            <Button
              title="Telegram orqali kirish"
              icon="telegram"
              loading={retrying}
              onPress={async () => {
                setRetrying(true);
                try {
                  await retryTelegram();
                } finally {
                  setRetrying(false);
                }
              }}
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Button title="Boshlash" onPress={() => navigation.navigate("Register")} />
            <Button title="Hisobim bor — kirish" variant="ghost" onPress={() => navigation.navigate("Login")} />
          </View>
        )}
      </View>
    </Screen>
  );
}
