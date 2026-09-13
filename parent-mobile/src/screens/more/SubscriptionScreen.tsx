import React, { useCallback, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { colors, radius, spacing } from "../../theme";
import { formatDate } from "../../lib/format";
import { openExternalLink } from "../../lib/telegram";
import {
  BillingStatus,
  checkout,
  getBillingStatus,
  getPlans,
  Plan,
  PlanDuration,
  PlanId,
  Provider,
} from "../../api/billing";
import { useQuery } from "../../hooks/useQuery";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  LoadingState,
  Meter,
  Muted,
  Screen,
  Spino24Mascot,
  Text,
  useToast,
} from "../../components";

function money(n: number) {
  return `${Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}

function openLink(url: string) {
  if (!openExternalLink(url)) Linking.openURL(url);
}

const DURATIONS: { months: PlanDuration; label: string }[] = [
  { months: 1, label: "1 oy" },
  { months: 3, label: "3 oy" },
  { months: 12, label: "1 yil" },
];

const ACCENT: Record<PlanId, { main: string; soft: string }> = {
  beta: { main: colors.blue, soft: colors.blueSoft },
  mini: { main: colors.mint, soft: colors.mintSoft },
  max: { main: colors.catPurple, soft: colors.catPurpleBg },
  tester: { main: colors.catPurple, soft: colors.catPurpleBg },
};

const FEATURE_ROWS: { key: keyof Plan["features"]; label: (v: any) => string }[] = [
  { key: "max_children", label: (v) => (v == null ? "Farzand: cheksiz" : `Farzand: ${v} tagacha`) },
  { key: "max_devices", label: (v) => (v == null ? "Qurilma: cheksiz" : `Qurilma: ${v} tagacha`) },
  { key: "history_days", label: (v) => (v == null ? "Tarix: cheksiz" : `Tarix: ${v} kun`) },
  {
    key: "screenshot_daily_limit",
    label: (v) => (v == null ? "Skrinshot: cheksiz" : v === 0 ? "Skrinshot: yo'q" : `Skrinshot: kuniga ${v} ta`),
  },
  { key: "ai_analysis", label: (v) => (v ? "AI tahlil: bor" : "AI tahlil: yo'q") },
];

function DurationPicker({
  plan,
  months,
  onChange,
  accent,
}: {
  plan: Plan;
  months: PlanDuration;
  onChange: (m: PlanDuration) => void;
  accent: { main: string; soft: string };
}) {
  if (!plan.durations) return null;
  const oneMonth = plan.durations[1];
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {DURATIONS.map((d) => {
        const price = plan.durations?.[d.months];
        if (price == null) return null;
        const fullPrice = oneMonth != null ? oneMonth * d.months : null;
        const pct = fullPrice != null && fullPrice > price ? Math.round((1 - price / fullPrice) * 100) : 0;
        const active = months === d.months;
        return (
          <View key={d.months} style={{ flex: 1 }}>
            <Pressable
              onPress={() => onChange(d.months)}
              style={{
                paddingVertical: 8,
                borderRadius: radius.md,
                alignItems: "center",
                backgroundColor: active ? accent.main : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: active ? accent.main : colors.border,
              }}
            >
              <Text variant="label" color={active ? "#fff" : colors.body}>
                {d.label}
              </Text>
            </Pressable>
            {pct > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -8,
                  right: -6,
                  backgroundColor: active ? colors.warning : colors.dangerSoft,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: radius.pill,
                }}
              >
                <Text variant="micro" color={active ? "#fff" : colors.danger}>
                  -{pct}%
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

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
  const [months, setMonths] = useState<PlanDuration>(1);
  const accent = ACCENT[plan.plan];
  const highlight = plan.plan === "mini";

  const duration = plan.durations?.[months];
  const oneMonth = plan.durations?.[1];
  const price = duration ?? plan.price_uzs;
  const fullPrice = oneMonth != null ? oneMonth * months : null;
  const hasDiscount = fullPrice != null && duration != null && fullPrice > duration;
  const discountPct = hasDiscount ? Math.round((1 - duration! / fullPrice!) * 100) : 0;
  const periodLabel = plan.plan === "beta" ? `${plan.trial_days ?? 7} kun` : DURATIONS.find((d) => d.months === months)?.label ?? "";

  const payable = plan.plan !== "beta" && !current && duration != null;
  const anyProvider = providersAvailable.payme || providersAvailable.click;

  const buy = useCallback(
    async (provider: Provider) => {
      setBusy(provider);
      try {
        const result = await checkout(plan.plan as PlanId, provider, months);
        openLink(result.checkout_url);
      } catch (e: any) {
        toast.error(e?.message ?? "To'lovga o'tib bo'lmadi");
      } finally {
        setBusy(null);
      }
    },
    [plan.plan, months, toast],
  );

  return (
    <Card
      style={{
        gap: 12,
        borderWidth: highlight ? 2 : current ? 2 : 1,
        borderColor: highlight ? colors.mint : current ? colors.blue : colors.cardBorder,
      }}
    >
      {highlight ? (
        <View style={{ alignSelf: "flex-start" }}>
          <Badge label="⭐ Eng ommabop" color="#fff" bg={colors.mintDark} />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Spino24Mascot width={44} />
        <View style={{ flex: 1 }}>
          <Text variant="h3">{plan.label.replace(/\s*\(.*\)/, "")}</Text>
          <Muted>
            {plan.plan === "beta"
              ? "Bepul sinov tarifi"
              : plan.plan === "mini"
                ? "Asosiy imkoniyatlar"
                : "To'liq imkoniyatlar"}
          </Muted>
        </View>
        {current ? <Badge label="Joriy" color={colors.blue} bg={colors.blueSoft} /> : null}
      </View>

      {plan.durations ? (
        <DurationPicker plan={plan} months={months} onChange={setMonths} accent={accent} />
      ) : null}

      {hasDiscount ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text variant="body" color={colors.muted} style={{ textDecorationLine: "line-through" }}>
            {money(fullPrice!)}
          </Text>
          <Badge label={`-${discountPct}%`} color="#fff" bg={accent.main} />
        </View>
      ) : null}
      <Text variant="h1">
        {price > 0 ? money(price) : "Bepul"}
        <Text variant="body" color={colors.muted}>
          {" "}
          / {periodLabel}
        </Text>
      </Text>

      <View style={{ gap: 6 }}>
        {FEATURE_ROWS.map((row) => (
          <View key={row.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: accent.soft,
              }}
            >
              <Icon name="check" size={11} color={accent.main} />
            </View>
            <Muted>{row.label((plan.features as any)[row.key])}</Muted>
          </View>
        ))}
      </View>

      {plan.plan === "beta" ? (
        current ? null : (
          <Muted>Har bir oila ro'yxatdan o'tganda avtomatik oladi.</Muted>
        )
      ) : payable ? (
        anyProvider ? (
          <View style={{ gap: 8 }}>
            {testMode ? <Muted>Sinov (test) rejimi — haqiqiy pul yechilmaydi.</Muted> : null}
            {providersAvailable.payme ? (
              <Button
                title={busy === "payme" ? "Kutilmoqda..." : `${plan.label}'ga o'tish — Payme`}
                onPress={() => buy("payme")}
                loading={busy === "payme"}
                disabled={busy !== null}
                style={{ backgroundColor: accent.main }}
              />
            ) : null}
            {providersAvailable.click ? (
              <Button
                title={busy === "click" ? "Kutilmoqda..." : `${plan.label}'ga o'tish — Click`}
                onPress={() => buy("click")}
                loading={busy === "click"}
                disabled={busy !== null}
                variant="secondary"
              />
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Icon name="shield" size={13} color={colors.muted} />
              <Muted>Xavfsiz to'lov</Muted>
            </View>
          </View>
        ) : (
          <Muted>To'lov usullari hozircha ulanmagan.</Muted>
        )
      ) : null}
    </Card>
  );
}

function TrustRow() {
  const items: { icon: "card" | "clock" | "shield" | "heart"; title: string; body: string }[] = [
    { icon: "card", title: "Karta talab qilinmaydi", body: "Beta tarifida" },
    { icon: "clock", title: "Hech qanday majburiyat", body: "Avtomatik yechilmaydi" },
    { icon: "shield", title: "Ma'lumotlaringiz xavfsiz", body: "Zamonaviy himoya" },
    { icon: "heart", title: "Siz bilan birgamiz", body: "Savol bo'lsa — yordam beramiz" },
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
      {items.map((it) => (
        <View key={it.title} style={{ flexBasis: "47%", flexGrow: 1, flexDirection: "row", gap: 8 }}>
          <Icon name={it.icon} size={16} color={colors.blue} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={{ fontWeight: "700" }}>
              {it.title}
            </Text>
            <Muted>{it.body}</Muted>
          </View>
        </View>
      ))}
    </View>
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
        {status.plan === "beta" && status.trial_ends_at ? (
          status.trial_active ? (
            <Muted>7 kunlik bepul sinov — {formatDate(status.trial_ends_at)}gacha</Muted>
          ) : (
            <Muted>Bepul sinov muddati tugadi — davom etish uchun tarif tanlang.</Muted>
          )
        ) : null}
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
        .filter((p) => p.plan !== "tester" || status.plan === "tester")
        .map((p) => (
          <PlanCard
            key={p.plan}
            plan={p}
            current={p.plan === status.plan}
            testMode={status.payme_test_mode}
            providersAvailable={status.providers_available}
          />
        ))}

      <TrustRow />
    </Screen>
  );
}
