import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { colors, radius } from "../../theme";
import { formatDate } from "../../lib/format";
import { ApiError } from "../../api/client";
import { generateInsight, getCachedInsight, Period, RiskLevel, WeeklyInsight } from "../../api/insights";
import { useFamily } from "../../state/family";
import { useQuery } from "../../hooks/useQuery";
import {
  Badge,
  Button,
  Card,
  ChildSwitcher,
  EmptyState,
  Icon,
  LoadingState,
  Muted,
  Screen,
  Text,
} from "../../components";

const RISK_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  ok: { label: "Yaxshi", color: colors.mint, bg: colors.mintSoft },
  watch: { label: "Kuzatish kerak", color: colors.warning, bg: colors.warningSoft },
  concern: { label: "Tashvishli", color: colors.danger, bg: colors.dangerSoft },
};

const PERIOD_LABEL: Record<Period, string> = {
  last_week: "O'tgan hafta",
  this_week: "Shu hafta",
  today: "Bugun",
};
const PERIODS: Period[] = ["last_week", "this_week", "today"];

function PeriodSwitcher({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.chartTrack, borderRadius: radius.md, padding: 3 }}>
      {PERIODS.map((p) => (
        <Pressable
          key={p}
          onPress={() => onChange(p)}
          style={{
            flex: 1,
            paddingVertical: 9,
            borderRadius: radius.sm,
            backgroundColor: period === p ? colors.surface : "transparent",
            alignItems: "center",
          }}
        >
          <Text variant="micro" color={period === p ? colors.blue : colors.muted}>
            {PERIOD_LABEL[p]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function AIInsightScreen({ navigation }: any) {
  const { selectedChild } = useFamily();
  const [period, setPeriod] = useState<Period>("last_week");
  const { data, loading, error, refetch, reload, refreshing } = useQuery(
    () => getCachedInsight(selectedChild!.id, period),
    [selectedChild?.id, period],
    { enabled: !!selectedChild },
  );
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!selectedChild) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      await generateInsight(selectedChild.id, period);
      await reload();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Tahlil yaratib bo'lmadi");
    } finally {
      setGenerating(false);
    }
  }

  const header = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="label" color={colors.muted}>
          Farzand
        </Text>
        <ChildSwitcher onAddChild={() => navigation.navigate("AddChild")} />
      </View>
      <PeriodSwitcher period={period} onChange={setPeriod} />
    </>
  );

  if (!selectedChild) {
    return (
      <Screen>
        <EmptyState icon="users" title="Farzand tanlanmagan" message="Avval farzand qo'shing." />
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen scroll>
        {header}
        <LoadingState />
      </Screen>
    );
  }

  if (error instanceof ApiError && error.status === 403) {
    return (
      <Screen scroll>
        {header}
        <Card style={{ gap: 12, alignItems: "center" }}>
          <Icon name="sparkle" size={28} color={colors.blue} />
          <Text variant="h3">AI tahlil — Max tarifda</Text>
          <Muted style={{ textAlign: "center" }}>
            Farzandingiz faoliyatini sun'iy intellekt tahlil qilib, ekran vaqti va odatlari
            bo'yicha tushunarli tavsiyalar beradi.
          </Muted>
          <Button title="Obunani ko'rish" onPress={() => navigation.navigate("Subscription")} />
        </Card>
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen scroll refreshing={refreshing} onRefresh={refetch}>
        {header}
        <EmptyState icon="sparkle" title="Yuklanmadi" message={error.message ?? "Xatolik yuz berdi"} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen scroll refreshing={refreshing} onRefresh={refetch}>
        {header}
        <Card style={{ gap: 12, alignItems: "center" }}>
          <Icon name="sparkle" size={28} color={colors.blue} />
          <Text variant="h3">Hali tahlil yo'q</Text>
          <Muted style={{ textAlign: "center" }}>
            {period === "last_week"
              ? "Har hafta avtomatik tayyorlanadi — yoki hozir so'rov yuboring."
              : "Bu davr uchun hozir so'rov yuboring."}
          </Muted>
          {generateError ? <Muted style={{ color: colors.danger }}>{generateError}</Muted> : null}
          <Button title="Hozir tahlil qiling" onPress={handleGenerate} loading={generating} />
        </Card>
      </Screen>
    );
  }

  return (
    <InsightView
      header={header}
      data={data}
      childName={selectedChild.name}
      refreshing={refreshing}
      onRefresh={refetch}
      generating={generating}
      generateError={generateError}
      onRegenerate={handleGenerate}
    />
  );
}

function InsightView({
  header,
  data,
  childName,
  refreshing,
  onRefresh,
  generating,
  generateError,
  onRegenerate,
}: {
  header: React.ReactNode;
  data: WeeklyInsight;
  childName: string;
  refreshing: boolean;
  onRefresh: () => void;
  generating: boolean;
  generateError: string | null;
  onRegenerate: () => void;
}) {
  const risk = RISK_META[data.risk_level] ?? RISK_META.ok;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      {header}
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="h3">
            {childName} — {PERIOD_LABEL[data.period].toLowerCase()}
          </Text>
          <Badge label={risk.label} color={risk.color} bg={risk.bg} />
        </View>
        <Text variant="body">{data.summary}</Text>
        <Muted>Yangilangan: {formatDate(data.created_at, true)}</Muted>
      </Card>

      {data.highlights.length > 0 ? (
        <Card style={{ gap: 8 }}>
          <Text variant="h3">📌 Diqqatga molik</Text>
          {data.highlights.map((h, i) => (
            <Muted key={i}>• {h}</Muted>
          ))}
        </Card>
      ) : null}

      {data.recommendations.length > 0 ? (
        <Card style={{ gap: 8 }}>
          <Text variant="h3">💡 Tavsiyalar</Text>
          {data.recommendations.map((r, i) => (
            <Muted key={i}>• {r}</Muted>
          ))}
        </Card>
      ) : null}

      {generateError ? <Muted style={{ color: colors.danger }}>{generateError}</Muted> : null}
      <Button title="Qayta tahlil qiling" variant="secondary" onPress={onRegenerate} loading={generating} />
    </Screen>
  );
}
