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
  "O'rnatilgan asosiy dasturlar ro'yxati",
  "Taxminiy joylashuv (internet manzili yoki qurilma joylashuv xizmati orqali, shahar/tuman darajasida)",
];

const NOT_COLLECTED = [
  "Yozishmalar, xabarlar va parollar",
  "To‘liq web-manzillar (URL) va sahifa mazmuni",
  "Uzluksiz ekran yozuvi yoki avtomatik skrinshot",
  "Mikrofon yoki kamera",
  "Klaviatura bosishlari (keylogging)",
  "Uy manzili yoki xona darajasida aniq joylashuv",
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

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="camera" size={18} color={colors.blue} />
          <Text variant="h3">Ekran rasmi (so‘rov bo‘yicha)</Text>
        </View>
        <Text variant="body" color={colors.body}>
          Qurilma sahifasidan «Ekran rasmini olish» tugmasini bosganingizda
          ayni damdagi ekran rasmi bir marta olinadi. Bu avtomatik emas —
          faqat siz bosganingizda ishlaydi.
        </Text>
        {[
          "Farzand har safar buni ko‘radi — qurilmasida bildirishnoma chiqadi",
          "Rasm siz tanlagan muddat saqlanadi: 1 kun, 1 hafta yoki 1 oy",
          "Muddat o‘tgach rasm butunlay o‘chiriladi; istalgan vaqtda o‘zingiz ham o‘chira olasiz",
          "Soatiga 6 martadan ko‘p so‘rab bo‘lmaydi",
        ].map((t) => (
          <Row key={t} text={t} icon="check" color={colors.blue} />
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
