import React from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { formatDate } from "../../lib/format";
import { ApiError } from "../../api/client";
import { getWeeklyInsight, RiskLevel } from "../../api/insights";
import { useFamily } from "../../state/family";
import { useQuery } from "../../hooks/useQuery";
import {
  Badge,
  Button,
  Card,
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

export default function AIInsightScreen({ navigation }: any) {
  const { selectedChild } = useFamily();
  const { data, loading, error, refetch, refreshing } = useQuery(
    () => getWeeklyInsight(selectedChild!.id),
    [selectedChild?.id],
    { enabled: !!selectedChild },
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
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (error instanceof ApiError && error.status === 403) {
    return (
      <Screen scroll>
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
  if (error instanceof ApiError && error.status === 503) {
    return (
      <Screen scroll refreshing={refreshing} onRefresh={refetch}>
        <EmptyState icon="sparkle" title="Hozircha ulanmagan" message="AI tahlil tez orada ishga tushadi." />
      </Screen>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Screen scroll refreshing={refreshing} onRefresh={refetch}>
        <EmptyState
          icon="sparkle"
          title="Hali ma'lumot yo'q"
          message="Farzandingiz qurilmasi bir necha kun ishlatilgach, haftalik tahlil paydo bo'ladi."
        />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen scroll refreshing={refreshing} onRefresh={refetch}>
        <EmptyState icon="sparkle" title="Yuklanmadi" message={error?.message ?? "Xatolik yuz berdi"} />
      </Screen>
    );
  }

  const risk = RISK_META[data.risk_level] ?? RISK_META.ok;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="h3">{selectedChild.name} — bu hafta</Text>
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
    </Screen>
  );
}
