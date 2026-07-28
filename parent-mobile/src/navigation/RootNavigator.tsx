import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import LoginScreen from "../screens/auth/LoginScreen";
import SignupScreen from "../screens/auth/SignupScreen";
import QRScanScreen from "../screens/enroll/QRScanScreen";
import HomeScreen from "../screens/home/HomeScreen";
import RulesScreen from "../screens/rules/RulesScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  QRScan: undefined;
  Home: undefined;
  Rules: undefined;
  Alerts: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Kirish" }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: "Ro'yxatdan o'tish" }} />
      <Stack.Screen name="QRScan" component={QRScanScreen} options={{ title: "Qurilma qo'shish" }} />
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Bosh sahifa" }} />
      <Stack.Screen name="Rules" component={RulesScreen} options={{ title: "Qoidalar" }} />
      <Stack.Screen name="Alerts" component={AlertsScreen} options={{ title: "Bildirishnomalar" }} />
    </Stack.Navigator>
  );
}
