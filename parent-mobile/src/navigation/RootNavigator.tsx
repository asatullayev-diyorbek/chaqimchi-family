import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import LoginScreen from "../screens/auth/LoginScreen";
import SignupScreen from "../screens/auth/SignupScreen";
import QRScanScreen from "../screens/enroll/QRScanScreen";

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  QRScan: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Kirish" }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: "Ro'yxatdan o'tish" }} />
      <Stack.Screen name="QRScan" component={QRScanScreen} options={{ title: "Qurilma qo'shish" }} />
    </Stack.Navigator>
  );
}
