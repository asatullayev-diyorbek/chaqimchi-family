import React from "react";
import { useSession } from "../state/session";
import SplashScreen from "../screens/SplashScreen";
import OnboardingGate from "../screens/auth/OnboardingGate";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";

// FamilyProvider used to live here, but it sat inside the NavigationContainer
// that App.tsx remounts on every theme change (the cheapest way to repaint
// every screen) — so toggling dark/light silently refetched the whole
// family. It's now mounted in App.tsx, above that remount boundary, gated
// on the same "signed in and onboarded" condition this file used to check.
export default function RootNavigator() {
  const { status, user } = useSession();

  if (status === "loading") return <SplashScreen />;
  if (status === "signedOut") return <AuthNavigator />;
  if (user?.onboarding_required) return <OnboardingGate />;

  return <AppNavigator />;
}
