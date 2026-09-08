import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "./src/theme";
import { SessionProvider } from "./src/state/session";
import { ToastProvider } from "./src/components";
import { AppFrame } from "./src/components/AppFrame";
import RootNavigator from "./src/navigation/RootNavigator";

const navTheme = {
  dark: false,
  colors: {
    primary: colors.blue,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" as const },
    medium: { fontFamily: "System", fontWeight: "500" as const },
    bold: { fontFamily: "System", fontWeight: "700" as const },
    heavy: { fontFamily: "System", fontWeight: "800" as const },
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppFrame>
        <ToastProvider>
          <SessionProvider>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </SessionProvider>
        </ToastProvider>
      </AppFrame>
    </SafeAreaProvider>
  );
}
