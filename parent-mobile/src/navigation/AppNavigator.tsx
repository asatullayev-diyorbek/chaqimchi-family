import React from "react";
import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { colors, typography } from "../theme";
import { Icon, IconName } from "../components";
import { useAlertBadge } from "../hooks/useAlertBadge";

import HomeScreen from "../screens/home/HomeScreen";
import DeviceDetailScreen from "../screens/devices/DeviceDetailScreen";
import AddChildScreen from "../screens/family/AddChildScreen";
import PairDeviceScreen from "../screens/enroll/PairDeviceScreen";
import ActivityScreen from "../screens/activity/ActivityScreen";
import RulesScreen from "../screens/rules/RulesScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";
import AlertDetailScreen from "../screens/alerts/AlertDetailScreen";
import MoreScreen from "../screens/more/MoreScreen";
import ChildrenScreen from "../screens/family/ChildrenScreen";
import ChildDetailScreen from "../screens/family/ChildDetailScreen";
import DevicesScreen from "../screens/devices/DevicesScreen";
import ReportsScreen from "../screens/more/ReportsScreen";
import NotificationSettingsScreen from "../screens/more/NotificationSettingsScreen";
import SettingsScreen from "../screens/more/SettingsScreen";
import PrivacyScreen from "../screens/more/PrivacyScreen";
import HelpScreen from "../screens/more/HelpScreen";

const stackScreenOptions: NativeStackNavigationOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { ...typography.h3, color: colors.text },
  headerTintColor: colors.blue,
  contentStyle: { backgroundColor: colors.background },
};

const Home = createNativeStackNavigator();
function HomeStack() {
  return (
    <Home.Navigator screenOptions={stackScreenOptions}>
      <Home.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Home.Screen name="Devices" component={DevicesScreen} options={{ title: "Qurilmalar" }} />
      <Home.Screen name="DeviceDetail" component={DeviceDetailScreen} options={{ title: "Qurilma" }} />
      <Home.Screen name="Reports" component={ReportsScreen} options={{ title: "Hisobotlar" }} />
      <Home.Screen name="AddChild" component={AddChildScreen} options={{ title: "Farzand qo‘shish" }} />
      <Home.Screen name="PairDevice" component={PairDeviceScreen} options={{ title: "Qurilma ulash" }} />
    </Home.Navigator>
  );
}

const Activity = createNativeStackNavigator();
function ActivityStack() {
  return (
    <Activity.Navigator screenOptions={stackScreenOptions}>
      <Activity.Screen name="Activity" component={ActivityScreen} options={{ headerShown: false }} />
    </Activity.Navigator>
  );
}

const Rules = createNativeStackNavigator();
function RulesStack() {
  return (
    <Rules.Navigator screenOptions={stackScreenOptions}>
      <Rules.Screen name="Rules" component={RulesScreen} options={{ headerShown: false }} />
    </Rules.Navigator>
  );
}

const Alerts = createNativeStackNavigator();
function AlertsStack() {
  return (
    <Alerts.Navigator screenOptions={stackScreenOptions}>
      <Alerts.Screen name="Alerts" component={AlertsScreen} options={{ headerShown: false }} />
      <Alerts.Screen name="AlertDetail" component={AlertDetailScreen} options={{ title: "Ogohlantirish" }} />
    </Alerts.Navigator>
  );
}

const More = createNativeStackNavigator();
function MoreStack() {
  return (
    <More.Navigator screenOptions={stackScreenOptions}>
      <More.Screen name="More" component={MoreScreen} options={{ headerShown: false }} />
      <More.Screen name="Children" component={ChildrenScreen} options={{ title: "Farzandlar" }} />
      <More.Screen name="ChildDetail" component={ChildDetailScreen} options={{ title: "Farzand" }} />
      <More.Screen name="Devices" component={DevicesScreen} options={{ title: "Qurilmalar" }} />
      <More.Screen name="DeviceDetail" component={DeviceDetailScreen} options={{ title: "Qurilma" }} />
      <More.Screen name="Reports" component={ReportsScreen} options={{ title: "Hisobotlar" }} />
      <More.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: "Bildirishnomalar" }} />
      <More.Screen name="Settings" component={SettingsScreen} options={{ title: "Sozlamalar" }} />
      <More.Screen name="Privacy" component={PrivacyScreen} options={{ title: "Maxfiylik" }} />
      <More.Screen name="Help" component={HelpScreen} options={{ title: "Yordam" }} />
      <More.Screen name="AddChild" component={AddChildScreen} options={{ title: "Farzand qo‘shish" }} />
      <More.Screen name="PairDevice" component={PairDeviceScreen} options={{ title: "Qurilma ulash" }} />
    </More.Navigator>
  );
}

const Tab = createBottomTabNavigator();

function tabIcon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => <Icon name={name} size={size - 2} color={color} />;
}

export default function AppNavigator() {
  const badge = useAlertBadge();
  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 84 : 62,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "700" },
        tabBarLabelPosition: "below-icon",
        tabBarItemStyle: { paddingHorizontal: 2 },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: "Bosh sahifa", tabBarIcon: tabIcon("home") }} />
      <Tab.Screen name="ActivityTab" component={ActivityStack} options={{ title: "Faoliyat", tabBarIcon: tabIcon("activity") }} />
      <Tab.Screen name="RulesTab" component={RulesStack} options={{ title: "Qoidalar", tabBarIcon: tabIcon("rules") }} />
      <Tab.Screen
        name="AlertsTab"
        component={AlertsStack}
        options={{
          title: "Xabarlar",
          tabBarIcon: tabIcon("alerts"),
          tabBarBadge: badge || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
        }}
      />
      <Tab.Screen name="MoreTab" component={MoreStack} options={{ title: "Yana", tabBarIcon: tabIcon("more") }} />
    </Tab.Navigator>
  );
}
