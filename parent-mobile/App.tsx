import React, { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { palettes } from "./src/theme";
import { ThemeProvider, useTheme } from "./src/state/theme";
import { SessionProvider, useSession } from "./src/state/session";
import { FamilyProvider } from "./src/state/family";
import { ToastProvider } from "./src/components";
import { AppFrame } from "./src/components/AppFrame";
import RootNavigator from "./src/navigation/RootNavigator";
import { hideBackButton, onBackButtonClick, showBackButton } from "./src/lib/telegram";

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
  const navRef = useRef<NavigationContainerRef<any>>(null);

  const syncBackButton = () => {
    if (navRef.current?.canGoBack()) showBackButton();
    else hideBackButton();
  };

  useEffect(() => {
    return onBackButtonClick(() => {
      if (navRef.current?.canGoBack()) navRef.current.goBack();
    });
  }, []);

  return (
    <NavigationContainer
      key={mode}
      ref={navRef}
      theme={navTheme(mode)}
      initialState={stateRef.current as any}
      onReady={syncBackButton}
      onStateChange={(s) => {
        if (s) stateRef.current = s;
        syncBackButton();
      }}
    >
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
}

/**
 * FamilyProvider lives here, above Navigation's theme-remount boundary — the
 * same "signed in and onboarded" condition RootNavigator gates AppNavigator
 * on, kept in sync so a theme toggle can't reset it and force a refetch.
 */
function AppShell() {
  const { status, user } = useSession();
  const authed = status === "signedIn" && !user?.onboarding_required;
  return authed ? (
    <FamilyProvider>
      <Navigation />
    </FamilyProvider>
  ) : (
    <Navigation />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppFrame>
          <ToastProvider>
            <SessionProvider>
              <AppShell />
            </SessionProvider>
          </ToastProvider>
        </AppFrame>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
