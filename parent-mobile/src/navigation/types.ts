import type { Alert } from "../api/alerts";

export type AuthStackParams = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type HomeStackParams = {
  Home: undefined;
  ChildOverview: { childId: string };
  DeviceDetail: { deviceId: string };
  AddChild: undefined;
  PairDevice: { childId?: string } | undefined;
};

export type ActivityStackParams = {
  Activity: { deviceId?: string } | undefined;
};

export type RulesStackParams = {
  Rules: undefined;
};

export type AlertsStackParams = {
  Alerts: undefined;
  AlertDetail: { alert: Alert; childName?: string };
};

export type MoreStackParams = {
  More: undefined;
  Children: undefined;
  ChildDetail: { childId: string };
  Devices: undefined;
  DeviceDetail: { deviceId: string };
  Reports: undefined;
  NotificationSettings: undefined;
  Settings: undefined;
  Privacy: undefined;
  Help: undefined;
  AddChild: undefined;
  PairDevice: { childId?: string } | undefined;
};
