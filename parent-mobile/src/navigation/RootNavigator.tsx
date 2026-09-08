import React from "react";
import { useSession } from "../state/session";
import { FamilyProvider } from "../state/family";
import SplashScreen from "../screens/SplashScreen";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";

export default function RootNavigator() {
  const { status } = useSession();

  if (status === "loading") return <SplashScreen />;
  if (status === "signedOut") return <AuthNavigator />;

  return (
    <FamilyProvider>
      <AppNavigator />
    </FamilyProvider>
  );
}
