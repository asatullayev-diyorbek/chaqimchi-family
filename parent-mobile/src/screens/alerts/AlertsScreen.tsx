import React, { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { relativeTime } from "../../lib/format";
import { useFamily } from "../../state/family";
import { Alert, getAlerts, markAlertSeen } from "../../api/alerts";
import { useQuery } from "../../hooks/useQuery";
import {
  AlertCard,
  AppHeader,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Muted,
  Screen,
  Text,
  useToast,
} from "../../components";

type Enriched = Alert & { childName?: string };

const FILTERS: { key: string; label: string; test: (a: Alert) => boolean }[] = [
  { key: "all", label: "Barchasi", test: () => true },
  { key: "unseen", label: "Yangi", test: (a) => !a.seen },
  { key: "limit_reached", label: "Limit", test: (a) => a.alert_type === "limit_reached" },
  { key: "blocked_app_opened", label: "Bloklangan ilova", test: (a) => a.alert_type === "blocked_app_opened" },
  { key: "settings_panel_access", label: "Kattalar paneli", test: (a) => a.alert_type === "settings_panel_access" },
];

export default function AlertsScreen({ navigation }: any) {
  const toast = useToast();
  const { linkedDevices, children, loading: familyLoading } = useFamily();
  const [filter, setFilter] = useState("all");
  const [marking, setMarking] = useState(false);
  const [seenLocal, setSeenLocal] = useState<Set<string>>(new Set());

  const fetcher = useCallback(async () => {
    const lists = await Promise.all(
      linkedDevices.map(async (d) => {
        const items = await getAlerts(d.id).catch(() => [] as Alert[]);
        const childName = children.find((c) => c.id === d.child_id)?.name;
        return items.map((a) => ({ ...a, childName }) as Enriched);
      }),
    );
    return lists
      .flat()
      .sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime());
  }, [linkedDevices.map((d) => d.id).join(","), children.map((c) => c.id).join(",")]);

  const key = linkedDevices.map((d) => d.id).join(",") + "|" + children.map((c) => c.id).join(",");
  const { data, loading, error, refetch, refreshing } = useQuery(fetcher, [key], {
    enabled: linkedDevices.length > 0,
  });

  const all: Enriched[] = useMemo(
    () => (data ?? []).map((a) => (seenLocal.has(a.id) ? { ...a, seen: true } : a)),
    [data, seenLocal],
  );
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const visible = all.filter(active.test);
  const unseenCount = all.filter((a) => !a.seen).length;

  const markAll = useCallback(async () => {
    const unseen = all.filter((a) => !a.seen);
    if (!unseen.length || marking) return;
    setMarking(true);
    try {
      await Promise.all(unseen.map((a) => markAlertSeen(a.id)));
      setSeenLocal(new Set(all.map((a) => a.id)));
      toast.success(`${unseen.length} ta ogohlantirish ko‘rilgan deb belgilandi`);
    } catch (e: any) {
      toast.error(e?.message ?? "Yangilanmadi");
    } finally {
      setMarking(false);
    }
  }, [all, marking, toast]);

  const header = (
    <AppHeader
      title="Ogohlantirishlar"
      subtitle={unseenCount > 0 ? `${unseenCount} ta yangi` : "Hammasi ko‘rilgan"}
    />
  );

  if (familyLoading || (loading && linkedDevices.length > 0)) {
    return (
      <Screen scroll>
        {header}
        <View style={{ gap: 12 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      </Screen>
    );
  }
  if (linkedDevices.length === 0) {
    return (
      <Screen scroll>
        {header}
        <EmptyState icon="bell" title="Qurilma yo‘q" message="Ogohlantirishlar farzand qurilmasi ulangandan keyin paydo bo‘ladi." />
      </Screen>
    );
  }
  if (error && !data) {
    return (
      <Screen scroll>
        {header}
        <ErrorState message={error.message} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      {header}

      {all.length > 0 ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FILTERS.map((f) => (
              <Chip key={f.key} label={f.label} active={f.key === filter} onPress={() => setFilter(f.key)} />
            ))}
          </View>
          {unseenCount > 0 ? (
            <Button
              title={marking ? "Belgilanmoqda…" : "Barchasini ko‘rilgan deb belgilash"}
              variant="secondary"
              onPress={markAll}
              loading={marking}
            />
          ) : null}
        </>
      ) : null}

      {all.length === 0 ? (
        <EmptyState icon="shield" title="Hozircha ogohlantirish yo‘q" message="Hammasi xotirjam davom etmoqda." />
      ) : visible.length === 0 ? (
        <Muted style={{ textAlign: "center", paddingVertical: 24 }}>Bu filtr bo‘yicha ogohlantirish yo‘q.</Muted>
      ) : (
        <View style={{ gap: 10 }}>
          {visible.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              childName={a.childName}
              onPress={() => navigation.navigate("AlertDetail", { alert: a, childName: a.childName })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
