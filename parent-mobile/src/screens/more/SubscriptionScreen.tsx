import React, { useCallback, useState } from "react";
import { Linking, View } from "react-native";
import { colors, radius } from "../../theme";
import { formatDate } from "../../lib/format";
import { openExternalLink } from "../../lib/telegram";
import { BillingStatus, checkout, getBillingStatus, getPlans, Plan, PlanId, Provider } from "../../api/billing";
import { useQuery } from "../../hooks/useQuery";
import {
  Button,
  Card,
  ErrorState,
  Icon,
  LoadingState,
  Meter,
  Muted,
  Screen,
  Text,
  useToast,
} from "../../components";

function money(n: number) {
  return `${Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}

function openLink(url: string) {
  if (!openExternalLink(url)) Linking.openURL(url);
}

const FEATURE_ROWS: { key: keyof Plan["features"]; label: (v: any) => string }[] = [
  { key: "max_children", label: (v) => (v == null ? "Farzand: cheksiz" : `Farzand: ${v} tagacha`) },
  { key: "max_devices", label: (v) => (v == null ? "Qurilma: cheksiz" : `Qurilma: ${v} tagacha`) },
  { key: "history_days", label: (v) => (v == null ? "Tarix: cheksiz" : `Tarix: ${v} kun`) },
  {
    key: "screenshot_daily_limit",
    label: (v) => (v == null ? "Skrinshot: cheksiz" : `Skrinshot: kuniga ${v} ta`),
  },
  { key: "ai_analysis", label: (v) => (v ? "AI tahlil: bor" : "AI tahlil: yo'q") },
];

function PlanCard({
  plan,
  current,
  testMode,
  providersAvailable,
}: {
  plan: Plan;
  current: boolean;
  testMode: boolean;
  providersAvailable: { payme: boolean; click: boolean };
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<Provider | null>(null);
  const payable = plan.plan !== "beta" && !current;
  const anyProvider = providersAvailable.payme || providersAvailable.click;

  const buy = useCallback(
    async (provider: Provider) => {
      setBusy(provider);
      try {
        const result = await checkout(plan.plan as PlanId, provider);
        openLink(result.checkout_url);
      } catch (e: any) {
        toast.error(e?.message ?? "To'lovga o'tib bo'lmadi");
      } finally {
        setBusy(null);
      }
    },
    [plan.plan, toast],
  );

  return (
    <Card
      style={{
        gap: 10,
        borderWidth: current ? 2 : 1,
        borderColor: current ? colors.blue : colors.cardBorder,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="h3">{plan.label}</Text>
        {current ? (
          <View
            style={{
              backgroundColor: colors.blueSoft,
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text variant="label" color={colors.blue}>
              Joriy
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="h2">{plan.price_uzs > 0 ? `${money(plan.price_uzs)} / oy` : "Bepul"}</Text>
      <View style={{ gap: 4 }}>
        {FEATURE_ROWS.map((row) => (
          <View key={row.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="check" size={14} color={colors.mint} />
            <Muted>{row.label((plan.features as any)[row.key])}</Muted>
          </View>
        ))}
      </View>

      {payable ? (
        anyProvider ? (
          <View style={{ gap: 8 }}>
            {testMode ? (
              <Muted>Sinov (test) rejimi — haqiqiy pul yechilmaydi.</Muted>
            ) : null}
            {providersAvailable.payme ? (
              <Button
                title={busy === "payme" ? "Kutilmoqda..." : `Payme orqali o'tish`}
                onPress={() => buy("payme")}
                loading={busy === "payme"}
                disabled={busy !== null}
              />
            ) : null}
            {providersAvailable.click ? (
              <Button
                title={busy === "click" ? "Kutilmoqda..." : `Click orqali o'tish`}
                onPress={() => buy("click")}
                loading={busy === "click"}
                disabled={busy !== null}
                variant="secondary"
              />
            ) : null}
          </View>
        ) : (
          <Muted>To'lov usullari hozircha ulanmagan.</Muted>
        )
      ) : null}
    </Card>
  );
}

export default function SubscriptionScreen() {
  const { data, loading, error, refetch, refreshing } = useQuery(
    () => Promise.all([getBillingStatus(), getPlans()]),
    [],
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorState message={error?.message ?? "Yuklanmadi"} onRetry={refetch} />
      </Screen>
    );
  }

  const [status, plans]: [BillingStatus, Plan[]] = data;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="card" size={18} color={colors.blue} />
          <Text variant="h3">Joriy tarif: {status.plan_label}</Text>
        </View>
        {status.expires_at ? (
          <Muted>Amal qiladi: {formatDate(status.expires_at)}gacha</Muted>
        ) : null}

        {status.usage.children_limit != null || status.usage.devices_limit != null ? (
          <View style={{ gap: 10 }}>
            {status.usage.children_limit != null ? (
              <View style={{ gap: 4 }}>
                <Muted>
                  Farzand: {status.usage.children}/{status.usage.children_limit}
                </Muted>
                <Meter value={status.usage.children} max={status.usage.children_limit} />
              </View>
            ) : null}
            {status.usage.devices_limit != null ? (
              <View style={{ gap: 4 }}>
                <Muted>
                  Qurilma: {status.usage.devices}/{status.usage.devices_limit}
                </Muted>
                <Meter value={status.usage.devices} max={status.usage.devices_limit} />
              </View>
            ) : null}
          </View>
        ) : (
          <Muted>Farzand va qurilma soni cheksiz.</Muted>
        )}
      </Card>

      {plans
        .filter((p) => p.plan !== "beta" || status.plan === "beta")
        .map((p) => (
          <PlanCard
            key={p.plan}
            plan={p}
            current={p.plan === status.plan}
            testMode={status.payme_test_mode}
            providersAvailable={status.providers_available}
          />
        ))}
    </Screen>
  );
}
