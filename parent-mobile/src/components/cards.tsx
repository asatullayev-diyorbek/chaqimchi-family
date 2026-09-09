import React from "react";
import { Pressable, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { formatMinutes, formatMinutesShort, relativeTime } from "../lib/format";
import { appDisplay, domainDisplay } from "../lib/appDisplay";
import type { Alert } from "../api/alerts";
import type { Device } from "../api/tracking";
import { Avatar, PlatformBadge, StatusDot } from "./Avatar";
import { AppIcon, SiteIcon } from "./AppIcon";
import { Icon, IconName } from "./Icon";
import { Card, Muted, Text } from "./primitives";
import { Meter, Sparkline } from "./charts";

// --- ChildCard (Home) ------------------------------------------------

export function ChildCard({
  name,
  photoUrl,
  seed,
  online,
  todayMinutes,
  limitMinutes,
  hasDevice,
  currentApp,
  unseenAlerts,
  weekMinutes,
  onPress,
}: {
  name: string;
  photoUrl?: string | null;
  seed?: string;
  online: boolean;
  todayMinutes: number;
  limitMinutes: number | null;
  hasDevice: boolean;
  currentApp?: string | null;
  unseenAlerts: number;
  /** last-7-days minutes, oldest→newest, for the mini trend */
  weekMinutes?: number[];
  onPress: () => void;
}) {
  const over = limitMinutes != null && todayMinutes > limitMinutes;
  const near = limitMinutes != null && !over && todayMinutes > limitMinutes * 0.85;
  return (
    <Card onPress={onPress} style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={name} photoUrl={photoUrl} seed={seed} size={46} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="h3">{name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {hasDevice ? (
              <>
                <StatusDot online={online} />
                <Muted>
                  {online
                    ? currentApp
                      ? appDisplay(currentApp).label
                      : "Onlayn"
                    : "Oflayn"}
                </Muted>
              </>
            ) : (
              <Muted>Qurilma ulanmagan</Muted>
            )}
          </View>
        </View>
        {unseenAlerts > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              backgroundColor: colors.warningSoft,
              borderRadius: radius.pill,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Icon name="alert" size={12} color={colors.warning} />
            <Text variant="micro" color={colors.warning}>
              {unseenAlerts}
            </Text>
          </View>
        ) : (
          <Icon name="chevronRight" size={18} color={colors.faint} />
        )}
      </View>

      {hasDevice ? (
        <View style={{ gap: 9 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <View style={{ gap: 2 }}>
              <Text variant="h1" style={{ fontSize: 24 }} color={over ? colors.danger : colors.text}>
                {formatMinutes(todayMinutes)}
              </Text>
              <Muted>
                {limitMinutes
                  ? over
                    ? `Limitdan ${formatMinutesShort(todayMinutes - limitMinutes)} oshdi`
                    : `${formatMinutesShort(limitMinutes - todayMinutes)} qoldi`
                  : "Bugungi ekran vaqti"}
              </Muted>
            </View>
            {weekMinutes && weekMinutes.length > 1 ? (
              <Sparkline
                values={weekMinutes}
                color={over ? colors.danger : near ? colors.warning : colors.blue}
              />
            ) : null}
          </View>
          {limitMinutes ? (
            <Meter value={todayMinutes} max={limitMinutes} tone={over ? "danger" : near ? "warn" : "blue"} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

// --- DeviceCard -----------------------------------------------------

export function DeviceCard({
  device,
  online,
  battery,
  onPress,
}: {
  device: Device;
  online?: boolean;
  battery?: number | null;
  onPress?: () => void;
}) {
  const isOnline = online ?? (device.last_sync ? Date.now() - new Date(device.last_sync).getTime() < 5 * 60_000 : false);
  return (
    <Card onPress={onPress} style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: colors.blueSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={device.platform === "windows" ? "laptop" : "phone"} size={20} color={colors.blue} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{device.child_name || "Qurilma"}</Text>
          <PlatformBadge platform={device.platform} />
        </View>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <StatusDot online={isOnline} />
            <Muted>{isOnline ? "Onlayn" : "Oflayn"}</Muted>
          </View>
          {typeof battery === "number" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="battery" size={13} color={colors.faint} />
              <Text variant="micro" color={colors.faint}>
                {battery}%
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Muted>
        {isOnline ? "Faol" : `Oxirgi aloqa: ${relativeTime(device.last_sync)}`}
        {device.agent_version ? ` · v${device.agent_version}` : ""}
      </Muted>
    </Card>
  );
}

// --- DeviceRow (compact, for the Home devices list) ---------------

export function DeviceRow({
  device,
  online,
  todayMinutes,
  selected = false,
  first = false,
  onPress,
}: {
  device: Device;
  online: boolean;
  todayMinutes: number;
  selected?: boolean;
  first?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.blue : colors.blueSoft,
        }}
      >
        <Icon
          name={device.platform === "windows" ? "laptop" : device.platform === "ios" ? "tablet" : "phone"}
          size={18}
          color={selected ? "#fff" : colors.blue}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>
          {device.child_name || (device.platform === "windows" ? "Kompyuter" : "Qurilma")}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <StatusDot online={online} size={7} />
          <Muted>
            {online
              ? `Onlayn · ${formatMinutes(todayMinutes)}`
              : `Oflayn · ${relativeTime(device.last_sync)}`}
          </Muted>
        </View>
      </View>
      {onPress ? <Icon name="chevronRight" size={16} color={colors.faint} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
      {content}
    </Pressable>
  );
}

// --- StatCard -----------------------------------------------------

export function StatCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  hint,
}: {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card style={{ flex: 1, gap: 8, minWidth: 150 }}>
      <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={17} color={iconColor} />
      </View>
      <View style={{ gap: 2 }}>
        <Muted>{label}</Muted>
        <Text variant="h3">{value}</Text>
        {hint ? <Text variant="micro" color={colors.faint}>{hint}</Text> : null}
      </View>
    </Card>
  );
}

// --- AlertCard ---------------------------------------------------

const ALERT_STYLE: Record<string, { icon: IconName; color: string; bg: string }> = {
  limit_reached: { icon: "clock", color: colors.warning, bg: colors.warningSoft },
  blocked_app_opened: { icon: "shieldOff", color: colors.blue, bg: colors.blueSoft },
  settings_panel_access: { icon: "user", color: colors.mint, bg: colors.mintSoft },
};

export function describeAlert(alert: Alert): string {
  if (alert.alert_type === "blocked_app_opened") {
    const app = typeof alert.payload.app === "string" ? appDisplay(alert.payload.app).label : "Ilova";
    return `${app} ochilishi cheklandi`;
  }
  if (alert.alert_type === "settings_panel_access") {
    return "Qurilmada «Kattalar uchun» paneli ochildi";
  }
  if ((alert.payload as any)?.reason === "quiet_hours") {
    return "Tinch soatlar — ekran bloklandi";
  }
  return "Bugungi ekran vaqti limiti tugadi";
}

export function AlertCard({
  alert,
  childName,
  onPress,
}: {
  alert: Alert;
  childName?: string;
  onPress?: () => void;
}) {
  const s = ALERT_STYLE[alert.alert_type] ?? ALERT_STYLE.limit_reached;
  return (
    <Card onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: alert.seen ? 0.62 : 1 }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: s.bg, alignItems: "center", justifyContent: "center" }}>
        <Icon name={s.icon} size={19} color={s.color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="label">{describeAlert(alert)}</Text>
        <Muted>
          {childName ? `${childName} · ` : ""}
          {relativeTime(alert.triggered_at)}
        </Muted>
      </View>
      {!alert.seen ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning }} />
      ) : null}
    </Card>
  );
}

// --- Rows -------------------------------------------------------

function ProportionBar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <View style={{ height: 4, borderRadius: 999, backgroundColor: colors.chartTrack, overflow: "hidden" }}>
      <View
        style={{
          width: `${Math.max(3, Math.min(100, ratio * 100))}%`,
          height: "100%",
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function AppUsageRow({
  appId,
  appName,
  icon,
  minutes,
  meta,
  maxMinutes,
  rank,
  first = false,
}: {
  appId: string;
  appName?: string | null;
  icon?: string | null;
  minutes: number;
  meta?: string;
  /** peak minutes in the list — draws a proportion bar when set */
  maxMinutes?: number;
  rank?: number;
  first?: boolean;
}) {
  const d = appDisplay(appId, appName);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      {rank ? (
        <Text variant="micro" color={colors.faint} style={{ width: 14, textAlign: "center" }}>
          {rank}
        </Text>
      ) : null}
      <AppIcon appId={appId} appName={appName} icon={icon} size={38} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
            {d.label}
          </Text>
          <Text variant="caption" color={colors.body}>
            {formatMinutes(minutes)}
          </Text>
        </View>
        {maxMinutes && maxMinutes > 0 ? (
          <ProportionBar ratio={minutes / maxMinutes} color={d.color} />
        ) : (
          <Muted>{meta ?? d.categoryLabel}</Muted>
        )}
      </View>
    </View>
  );
}

export function WebsiteUsageRow({
  domain,
  minutes,
  visits,
  maxVisits,
  rank,
  first = false,
}: {
  domain: string;
  minutes: number;
  visits: number;
  maxVisits?: number;
  rank?: number;
  first?: boolean;
}) {
  const d = domainDisplay(domain);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
      }}
    >
      {rank ? (
        <Text variant="micro" color={colors.faint} style={{ width: 14, textAlign: "center" }}>
          {rank}
        </Text>
      ) : null}
      <SiteIcon domain={domain} color={d.color} initial={d.initial} size={38} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
            {d.label}
          </Text>
          <Text variant="caption" color={colors.body}>
            {minutes > 0 ? formatMinutes(minutes) : `${visits} tashrif`}
          </Text>
        </View>
        {maxVisits && maxVisits > 0 ? (
          <ProportionBar ratio={visits / maxVisits} color={d.color} />
        ) : (
          <Muted>{visits} ta tashrif</Muted>
        )}
      </View>
    </View>
  );
}

export const SPACING = spacing;
