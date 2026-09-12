import React from "react";
import Feather from "@expo/vector-icons/Feather";
import { colors } from "../theme";

// One semantic name → one Feather glyph. Screens never reference Feather
// directly, so the icon set can be swapped in one place. Feather is a thin
// line set close to Lucide — matches the parent-web solar/hugeicons weight.
const MAP = {
  home: "home",
  activity: "bar-chart-2",
  rules: "shield",
  alerts: "bell",
  more: "grid",
  clock: "clock",
  calendar: "calendar",
  moon: "moon",
  sun: "sunrise",
  device: "monitor",
  phone: "smartphone",
  tablet: "tablet",
  laptop: "monitor",
  battery: "battery",
  wifi: "wifi",
  wifiOff: "wifi-off",
  globe: "globe",
  app: "grid",
  lock: "lock",
  pause: "pause-circle",
  plus: "plus",
  plusCircle: "plus-circle",
  close: "x",
  check: "check",
  checkCircle: "check-circle",
  chevronRight: "chevron-right",
  chevronLeft: "chevron-left",
  chevronDown: "chevron-down",
  chevronUp: "chevron-up",
  arrowRight: "arrow-right",
  arrowLeft: "arrow-left",
  edit: "edit-2",
  trash: "trash-2",
  user: "user",
  users: "users",
  settings: "settings",
  bell: "bell",
  bellOff: "bell-off",
  info: "info",
  help: "help-circle",
  shield: "shield",
  shieldOff: "shield-off",
  eye: "eye",
  eyeOff: "eye-off",
  alert: "alert-triangle",
  refresh: "refresh-cw",
  logout: "log-out",
  camera: "camera",
  qr: "maximize",
  send: "send",
  telegram: "send",
  clockPlus: "clock",
  chart: "trending-up",
  privacy: "eye-off",
  sparkle: "star",
  link: "link",
  key: "key",
  mail: "mail",
  filter: "sliders",
  pin: "map-pin",
  package: "package",
} as const;

export type IconName = keyof typeof MAP;

export function Icon({
  name,
  size = 20,
  color = colors.body,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Feather name={MAP[name] as any} size={size} color={color} />;
}
