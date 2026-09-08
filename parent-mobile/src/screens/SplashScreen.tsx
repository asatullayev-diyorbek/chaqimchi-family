import React from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../theme";
import { Screen, Spino24Logo, Text } from "../components";

export default function SplashScreen() {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20 }}>
        <Spino24Logo width={240} />
        <Text variant="caption" color={colors.muted} style={{ textAlign: "center" }}>
          Oilangizning raqamli hayoti — bir joyda.
        </Text>
        <ActivityIndicator color={colors.blue} style={{ marginTop: 14 }} />
      </View>
    </Screen>
  );
}
