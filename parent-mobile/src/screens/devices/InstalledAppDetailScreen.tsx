import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { colors, radius } from "../../theme";
import { formatDate, formatMinutes } from "../../lib/format";
import { InstalledApp } from "../../api/tracking";
import { appDailyLimitRule, blockedApps, createRule, deleteRule, getRules } from "../../api/rules";
import { getAppInfo, generateAppInfo, AppInfo } from "../../api/appinfo";
import { useQuery } from "../../hooks/useQuery";
import {
  AppIcon,
  Badge,
  Button,
  Card,
  DurationPickerSheet,
  LoadingState,
  Muted,
  Screen,
  SectionHeader,
  Text,
} from "../../components";

type RuleMode = "none" | "limit" | "block";
const DEFAULT_LIMIT_MINUTES = 60;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Muted>{label}</Muted>
      <Text variant="label">{value}</Text>
    </View>
  );
}

function ModePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 9,
        borderRadius: radius.sm,
        backgroundColor: active ? colors.surface : "transparent",
        alignItems: "center",
      }}
    >
      <Text variant="micro" color={active ? colors.blue : colors.muted}>
        {label}
      </Text>
    </Pressable>
  );
}

function RuleStatusCard({ deviceId, app }: { deviceId: string; app: InstalledApp }) {
  const { data: rules, loading, refetch } = useQuery(() => getRules(deviceId), [deviceId]);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (loading || !rules) return null;
  const blocked = blockedApps(rules).find((r) => r.value.app.toLowerCase() === app.name.toLowerCase());
  const limit = appDailyLimitRule(rules, app.name);
  const mode: RuleMode = blocked ? "block" : limit ? "limit" : "none";

  async function clearExisting() {
    if (blocked) await deleteRule(blocked.id);
    if (limit) await deleteRule(limit.id);
  }

  async function setMode(next: RuleMode) {
    if (next === mode) return;
    setBusy(true);
    try {
      await clearExisting();
      if (next === "block") {
        await createRule(deviceId, "blocked_app", { app: app.name });
      } else if (next === "limit") {
        setPickerOpen(true);
        return; // saveLimit below creates the rule once minutes are picked
      }
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  async function saveLimit(minutes: number) {
    setBusy(true);
    try {
      await clearExisting();
      await createRule(deviceId, "app_daily_limit_minutes", { app: app.name, minutes });
      await refetch();
    } finally {
      setBusy(false);
      setPickerOpen(false);
    }
  }

  const description: Record<RuleMode, string> = {
    none: "Bu ilova uchun hozircha cheklov yo'q.",
    limit: `Kuniga ${formatMinutes(limit?.value.minutes ?? 0)} vaqt beriladi.`,
    block: "Bu ilova hozir bloklangan — farzandingiz uni ocha olmaydi.",
  };

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="h3">Qoida</Text>
        {mode === "block" ? <Badge label="Bloklangan" color={colors.danger} bg={colors.dangerSoft} /> : null}
        {mode === "limit" ? <Badge label="Vaqt cheklovi" color={colors.warning} bg={colors.warningSoft} /> : null}
      </View>
      <Muted>{description[mode]}</Muted>

      <View style={{ flexDirection: "row", backgroundColor: colors.chartTrack, borderRadius: radius.md, padding: 3 }}>
        <ModePill label="Cheklovsiz" active={mode === "none"} onPress={() => setMode("none")} />
        <ModePill label="Vaqt cheklovi" active={mode === "limit"} onPress={() => setMode("limit")} />
        <ModePill label="To'liq bloklash" active={mode === "block"} onPress={() => setMode("block")} />
      </View>

      {mode === "limit" ? (
        <Button
          title="Vaqtni o'zgartirish"
          variant="secondary"
          onPress={() => setPickerOpen(true)}
          loading={busy}
        />
      ) : null}

      <DurationPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSubmit={saveLimit}
        title={`${app.name} uchun kunlik vaqt`}
        initial={limit?.value.minutes ?? DEFAULT_LIMIT_MINUTES}
        allowZero={false}
        showPresets={false}
        loading={busy}
      />
    </Card>
  );
}

function AppInfoCard({ app }: { app: InstalledApp }) {
  const { data: info, loading, reload } = useQuery<AppInfo | null>(
    () => getAppInfo(app.name),
    [app.name],
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await generateAppInfo(app.name, app.publisher);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumot olib bo'lmadi");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card style={{ gap: 10 }}>
      <SectionHeader icon="sparkle" title="Ilova haqida" hint={info ? undefined : "Sun'iy intellekt orqali"} />
      {loading ? (
        <LoadingState />
      ) : info ? (
        <View style={{ gap: 10 }}>
          {info.category ? <Badge label={info.category} color={colors.blue} bg={colors.blueSoft} /> : null}
          <Text variant="body">{info.description}</Text>

          {info.benefits.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text variant="label">✅ Foydali tomonlari</Text>
              {info.benefits.map((b, i) => (
                <Muted key={i}>• {b}</Muted>
              ))}
            </View>
          ) : null}

          {info.risks.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text variant="label">⚠️ Xavfli tomonlari</Text>
              {info.risks.map((r, i) => (
                <Muted key={i}>• {r}</Muted>
              ))}
            </View>
          ) : null}

          {info.age_note ? <Muted>👶 {info.age_note}</Muted> : null}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Muted>Bu ilova haqida hali ma'lumot yo'q — sun'iy intellekt orqali tushuntirish oling.</Muted>
          {error ? <Muted style={{ color: colors.danger }}>{error}</Muted> : null}
          <Button title="Ma'lumot olish" variant="secondary" onPress={handleGenerate} loading={generating} />
        </View>
      )}
    </Card>
  );
}

export default function InstalledAppDetailScreen({ route }: any) {
  const { app, deviceId } = route.params as { app: InstalledApp; deviceId: string };

  return (
    <Screen scroll>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <AppIcon appId={app.name} appName={app.name} icon={app.icon} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3" numberOfLines={1}>
            {app.name}
          </Text>
          <Muted numberOfLines={1}>{app.publisher || "Noma'lum ishlab chiqaruvchi"}</Muted>
        </View>
      </Card>

      <Card style={{ gap: 0 }}>
        <InfoRow label="Versiya" value={app.version || "—"} />
        <InfoRow label="O'rnatilgan sana" value={app.install_date ? formatDate(app.install_date, true) : "Noma'lum"} />
        <InfoRow label="Birinchi ko'rilgan" value={formatDate(app.first_seen, true)} />
        <InfoRow label="Oxirgi ko'rilgan" value={formatDate(app.last_seen, true)} />
        {app.uninstalled_at ? (
          <InfoRow label="O'chirilgan" value={formatDate(app.uninstalled_at, true)} />
        ) : null}
      </Card>

      <RuleStatusCard deviceId={deviceId} app={app} />
      <AppInfoCard app={app} />
    </Screen>
  );
}
