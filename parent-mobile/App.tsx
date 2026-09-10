import React, { useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { palettes } from "./src/theme";
import { ThemeProvider, useTheme } from "./src/state/theme";
import { SessionProvider } from "./src/state/session";
import { ToastProvider } from "./src/components";
import { AppFrame } from "./src/components/AppFrame";
import RootNavigator from "./src/navigation/RootNavigator";

function navTheme(mode: "light" | "dark") {
  const c = palettes[mode];
  return {
    dark: mode === "dark",
    colors: {
      primary: c.blue,
      background: c.background,
      card: c.surface,
      text: c.text,
      border: c.border,
      notification: c.danger,
    },
    fonts: {
      regular: { fontFamily: "System", fontWeight: "400" as const },
      medium: { fontFamily: "System", fontWeight: "500" as const },
      bold: { fontFamily: "System", fontWeight: "700" as const },
      heavy: { fontFamily: "System", fontWeight: "800" as const },
    },
  };
}

/** Re-mounting NavigationContainer on a theme change is the cheapest way to
 *  re-render every screen with the new palette; the nav state is restored
 *  from a ref so the parent keeps their place. */
function Navigation() {
  const { mode } = useTheme();
  const stateRef = useRef<object | undefined>(undefined);
  return (
    <NavigationContainer
      key={mode}
      theme={navTheme(mode)}
      initialState={stateRef.current as any}
      onStateChange={(s) => {
        if (s) stateRef.current = s;
      }}
    >
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppFrame>
          <ToastProvider>
            <SessionProvider>
              <Navigation />
            </SessionProvider>
          </ToastProvider>
        </AppFrame>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
