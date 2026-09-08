import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { colors } from "../../theme";
import { Card, Icon, Muted, Screen, Spino24Wordmark, Text } from "../../components";

const FAQ = [
  {
    q: "Qurilmani qanday ulash mumkin?",
    a: "Farzand kompyuteriga Spino24 dasturini o‘rnating. Dastur 6 xonali kod ko‘rsatadi — uni ilovadagi «Qurilma ulash» bo‘limiga kiriting.",
  },
  {
    q: "Qoida qo‘ydim, lekin qurilmada o‘zgarish yo‘q?",
    a: "Qoidalar qurilmaga keyingi sinxronizatsiyada yetadi — bu odatda bir necha daqiqa. Qurilma oflayn bo‘lsa, u onlayn bo‘lgach qo‘llanadi.",
  },
  {
    q: "Nega bir nechta qurilmaning ekran vaqti qo‘shilmaydi?",
    a: "Farzand ikki qurilmadan bir vaqtda foydalanishi mumkin. Ularni qo‘shsak, vaqt ikki marta hisoblanardi. Shuning uchun har bir qurilma alohida ko‘rsatiladi.",
  },
  {
    q: "Parolni unutdim.",
    a: "Telegram ulangan bo‘lsa, «Parolni unutdingizmi?» orqali Telegram’ga 6 xonali kod yuboriladi. Email yuborilmaydi.",
  },
  {
    q: "Android yoki iPhone qurilmalarni ulash mumkinmi?",
    a: "Hozircha faqat Windows kompyuterlar qo‘llab-quvvatlanadi. Boshqa platformalar keyinroq qo‘shiladi.",
  },
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen scroll>
      <Text variant="h2">Ko‘p so‘raladigan savollar</Text>
      {FAQ.map((item, i) => (
        <Card key={i} padded={false}>
          <Pressable
            onPress={() => setOpen(open === i ? null : i)}
            style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Text variant="label" style={{ flex: 1 }}>
              {item.q}
            </Text>
            <Icon name={open === i ? "chevronUp" : "chevronDown"} size={18} color={colors.faint} />
          </Pressable>
          {open === i ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Text variant="body" color={colors.body}>
                {item.a}
              </Text>
            </View>
          ) : null}
        </Card>
      ))}

      <View style={{ alignItems: "center", gap: 4, paddingVertical: 12 }}>
        <Spino24Wordmark size={16} />
        <Muted>Yordam kerakmi? Telegram: @spino24_support</Muted>
      </View>
    </Screen>
  );
}
