import React from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { Card, Icon, Muted, Screen, Text } from "../../components";

const COLLECTED = [
  "Ochilgan ilovalar nomi va ulardan foydalanish vaqti",
  "Tashrif buyurilgan web-saytlar domeni (masalan, youtube.com)",
  "Ekran vaqti va kunlik statistika",
  "Qurilma holati: onlayn/oflayn, batareya darajasi",
  "Dastur versiyasi",
];

const NOT_COLLECTED = [
  "Yozishmalar, xabarlar va parollar",
  "To‘liq web-manzillar (URL) va sahifa mazmuni",
  "Skrinshotlar yoki ekran yozuvi",
  "Mikrofon yoki kamera",
  "Klaviatura bosishlari (keylogging)",
  "Joylashuv (hozircha yig‘ilmaydi)",
];

export default function PrivacyScreen() {
  return (
    <Screen scroll>
      <Card style={{ gap: 8 }}>
        <Text variant="h2">Kuzatuv emas, tushuntirish</Text>
        <Text variant="body" color={colors.body}>
          Spino24 farzandingiz nima qilayotganini emas, qancha va qanday vaqt sarflayotganini
          ko‘rsatadi. Quyida aniq nima yig‘ilishi va nima yig‘ilmasligi keltirilgan.
        </Text>
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="eye" size={18} color={colors.blue} />
          <Text variant="h3">Yig‘iladigan ma’lumotlar</Text>
        </View>
        {COLLECTED.map((t) => (
          <Row key={t} text={t} icon="check" color={colors.blue} />
        ))}
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="eyeOff" size={18} color={colors.success} />
          <Text variant="h3">Yig‘ilmaydigan ma’lumotlar</Text>
        </View>
        {NOT_COLLECTED.map((t) => (
          <Row key={t} text={t} icon="close" color={colors.success} />
        ))}
      </Card>

      <Muted style={{ textAlign: "center" }}>
        Ma’lumot faqat sizning oilangiz hisobiga bog‘lanadi va boshqa oilalar bilan bo‘lishilmaydi.
      </Muted>
    </Screen>
  );
}

function Row({ text, icon, color }: { text: string; icon: "check" | "close"; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <Icon name={icon} size={16} color={color} />
      <Text variant="body" color={colors.body} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
