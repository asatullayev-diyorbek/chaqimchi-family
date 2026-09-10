import React from "react";
import { useSession } from "../state/session";
import { FamilyProvider } from "../state/family";
import SplashScreen from "../screens/SplashScreen";
import OnboardingGate from "../screens/auth/OnboardingGate";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";

export default function RootNavigator() {
  const { status, user } = useSession();

  if (status === "loading") return <SplashScreen />;
  if (status === "signedOut") return <AuthNavigator />;
  if (user?.onboarding_required) return <OnboardingGate />;

  return (
    <FamilyProvider>
      <AppNavigator />
    </FamilyProvider>
  );
}
