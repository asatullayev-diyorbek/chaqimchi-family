import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { colors, radius } from "../../theme";
import {
  addDaysISO,
  dayLabel,
  formatMinutes,
  formatMinutesShort,
  isTodayISO,
  shortWeekday,
  todayISO,
} from "../../lib/format";
import { useFamily } from "../../state/family";
import { getRules, getDailyLimitMinutes } from "../../api/rules";
import { getActivityTimeline, getSites, getSummary, SummaryRange } from "../../api/tracking";
import { useQuery } from "../../hooks/useQuery";
import { appDisplay } from "../../lib/appDisplay";
import {
  AppHeader,
  AppUsageRow,
  Card,
  ChildSelector,
  DayTimeline,
  DeviceScopePicker,
  EmptyState,
  ErrorState,
  IconButton,
  Muted,
  RingProgress,
  Screen,
  SectionHeader,
  SkeletonCard,
  SplitBar,
  Text,
  WebsiteUsageRow,
  WeekBars,
} from "../../components";

type Tab = "screen" | "apps" | "sites" | "timeline";
const TABS: { key: Tab; label: string }[] = [
  { key: "screen", label: "Ekran vaqti" },
  { key: "apps", label: "Ilovalar" },
  { key: "sites", label: "Web-saytlar" },
  { key: "timeline", label: "Vaqt jadvali" },
];
const RANGES: { key: SummaryRange; label: string }[] = [
  { key: "day", label: "Kun" },
  { key: "week", label: "Hafta" },
  { key: "month", label: "Oy" },
];

export default function ActivityScreen({ route }: any) {
  const family = useFamily();
  const { activeDevice, allDevices, childDevices, selectedChild, setDevice } = family;
  const [tab, setTab] = useState<Tab>("screen");
  const [range, setRange] = useState<SummaryRange>("day");
  const [date, setDate] = useState(todayISO());

  // Honour a deep link from Home / device rows.
  useEffect(() => {
    const id = route.params?.deviceId;
    if (id && childDevices.some((d) => d.id === id)) setDevice(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.deviceId, childDevices.length]);

  const deviceId = activeDevice?.id ?? "";
  const rangeQ = tab === "timeline" ? "day" : range;
  const dateQ = tab === "timeline" || range === "day" ? date : todayISO();

  const enabled = Boolean(deviceId) && tab !== "timeline";
  const summaryQ = useQuery(
    () => getSummary(deviceId, { date: dateQ, range: rangeQ }),
    [deviceId, dateQ, rangeQ, tab === "screen" || tab === "apps"],
    { enabled: enabled && (tab === "screen" || tab === "apps") },
  );
  const rulesQ = useQuery(() => getRules(deviceId), [deviceId], { enabled: Boolean(deviceId) });
  const sitesQ = useQuery(
    () => getSites(deviceId, { date: dateQ, range: rangeQ }),
    [deviceId, dateQ, rangeQ],
    { enabled: enabled && tab === "sites" },
  );
  const timelineQ = useQuery(
    () => getActivityTimeline(deviceId, { date }),
    [deviceId, date],
    { enabled: Boolean(deviceId) && tab === "timeline" },
  );

  const header = (
    <View style={{ gap: 12 }}>
      <AppHeader title="Faoliyat" subtitle={selectedChild?.name} />
      <ChildSelector />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <DeviceScopePicker />
        {tab === "timeline" || range === "day" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <IconButton name="chevronLeft" onPress={() => setDate(addDaysISO(date, -1))} accessibilityLabel="Oldingi kun" />
            <Text variant="label" style={{ minWidth: 74, textAlign: "center" }}>
              {dayLabel(date)}
            </Text>
            <IconButton
              name="chevronRight"
              onPress={() => !isTodayISO(date) && setDate(addDaysISO(date, 1))}
              accessibilityLabel="Keyingi kun"
              color={isTodayISO(date) ? colors.faint : colors.body}
            />
          </View>
        ) : null}
      </View>
      <Segmented tabs={TABS} value={tab} onChange={(t) => setTab(t as Tab)} />
      {tab !== "timeline" ? (
        <Segmented tabs={RANGES} value={range} onChange={(r) => setRange(r as SummaryRange)} small />
      ) : null}
    </View>
  );

  if (childDevices.length === 0) {
    return (
      <Screen scroll>
        {header}
        <EmptyState
          icon="device"
          title="Qurilma yo‘q"
          message="Faoliyatni ko‘rish uchun avval farzand qurilmasini ulang."
        />
      </Screen>
    );
  }

  if (allDevices) {
    return (
      <Screen scroll>
        {header}
        <Card style={{ gap: 10 }}>
          <Text variant="h3">Qurilmani tanlang</Text>
          <Text variant="body" color={colors.body}>
            {selectedChild?.name} bir nechta qurilmadan foydalanadi. Ekran vaqti ikki qurilmada bir
            vaqtda ishlatilgan bo‘lishi mumkinligi uchun ular qo‘shilmaydi — batafsil ko‘rish uchun
            bitta qurilmani tanlang.
          </Text>
          <View style={{ gap: 8, marginTop: 4 }}>
            {childDevices.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => setDevice(d.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text variant="label" style={{ flex: 1 }}>
                  {d.child_name || (d.platform === "windows" ? "Kompyuter" : "Qurilma")}
                </Text>
                <Muted>{d.platform === "windows" ? "Windows" : d.platform}</Muted>
              </Pressable>
            ))}
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshing={summaryQ.refreshing || sitesQ.refreshing || timelineQ.refreshing}
      onRefresh={() => {
        summaryQ.refetch();
        sitesQ.refetch();
        timelineQ.refetch();
        rulesQ.refetch();
      }}
    >
      {header}

      {tab === "screen" ? (
        <ScreenTimeTab
          q={summaryQ}
          range={range}
          limit={getDailyLimitMinutes(rulesQ.data ?? [])}
        />
      ) : tab === "apps" ? (
        <AppsTab q={summaryQ} />
      ) : tab === "sites" ? (
        <SitesTab q={sitesQ} />
      ) : (
        <TimelineTab q={timelineQ} isToday={isTodayISO(date)} />
      )}
    </Screen>
  );
}

// --- Segmented control ---------------------------------------------

function Segmented({
  tabs,
  value,
  onChange,
  small = false,
}: {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
  small?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceSunken,
        borderRadius: radius.md,
        padding: 4,
      }}
    >
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[
              {
                flex: 1,
                paddingVertical: small ? 7 : 9,
                borderRadius: radius.sm,
                backgroundColor: active ? colors.surface : "transparent",
                alignItems: "center",
              },
              active && {
                shadowColor: "#64748b",
                shadowOpacity: 0.14,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              },
            ]}
          >
            <Text
              style={{
                fontSize: small ? 11.5 : 12.5,
                fontWeight: "700",
                color: active ? colors.blue : colors.muted,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Tabs ---------------------------------------------------------

function ScreenTimeTab({ q, range, limit }: { q: any; range: SummaryRange; limit: number | null }) {
  if (q.loading) return <TabSkeleton />;
  if (q.error && !q.data) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const s = q.data;
  if (!s) return null;

  const days = (s.breakdown ?? []).slice(range === "month" ? -30 : -7);
  const total = days.reduce((t: number, b: any) => t + (b.total_minutes || 0), 0);
  const avg = days.length ? Math.round(total / days.length) : 0;
  const bars = days.map((b: any) => ({
    label: shortWeekday(b.date),
    minutes: b.total_minutes || 0,
    weekend: [0, 6].includes(new Date(`${b.date}T00:00:00`).getDay()),
  }));

  const used = s.total_screen_minutes as number;
  const over = limit != null && used > limit;

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ alignItems: "center", gap: 12 }}>
        {range === "day" ? (
          <>
            <RingProgress
              value={used}
              max={limit}
              centerTop={formatMinutesShort(used)}
              centerBottom={
                limit
                  ? over
                    ? `Limitdan ${formatMinutesShort(used - limit)} oshdi`
                    : `${formatMinutesShort(limit - used)} qoldi`
                  : "Bugungi ekran vaqti"
              }
            />
            <Text variant="body" color={colors.body}>
              {formatMinutes(used)}
              {limit ? ` · limit ${formatMinutes(limit)}` : ""}
            </Text>
          </>
        ) : (
          <>
            <Text variant="display">{formatMinutes(total)}</Text>
            <Muted>
              {range === "month" ? "30 kunlik jami" : "7 kunlik jami"} · kuniga {formatMinutes(avg)}
            </Muted>
          </>
        )}
      </Card>

      {bars.length > 0 ? (
        <Card style={{ gap: 14 }}>
          <SectionHeader
            title={`${range === "month" ? "30 kunlik" : "7 kunlik"} statistika`}
            hint={`o‘rtacha ${formatMinutes(avg)}`}
          />
          <WeekBars days={bars} height={range === "month" ? 118 : 138} showValues={range !== "month"} />
        </Card>
      ) : null}
    </View>
  );
}

function TabSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
    </View>
  );
}

function AppsTab({ q }: { q: any }) {
  if (q.loading) return <TabSkeleton />;
  if (q.error && !q.data) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const apps = (q.data?.top_apps ?? []) as any[];
  if (apps.length === 0) {
    return <EmptyState icon="app" title="Ilova faoliyati yo‘q" message="Bu davrda ilova ishlatilmagan yoki ma’lumot yig‘ilmagan." />;
  }
  const total = apps.reduce((t, a) => t + a.minutes, 0);
  const max = apps[0]?.minutes ?? 1;

  // Category rollup (client-derived — labelled as such).
  const byCat = new Map<string, number>();
  for (const a of apps) {
    const c = appDisplay(a.app).categoryLabel;
    byCat.set(c, (byCat.get(c) ?? 0) + a.minutes);
  }
  const cats = [...byCat.entries()]
    .map(([label, minutes]) => ({ label, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 4 }}>
        <Text variant="display" style={{ fontSize: 26 }}>
          {formatMinutes(total)}
        </Text>
        <Muted>{apps.length} ta ilova · shu davr</Muted>
      </Card>

      {cats.length > 1 ? (
        <Card style={{ gap: 12 }}>
          <SectionHeader title="Turlar bo‘yicha" hint="Ilova nomidan aniqlangan" />
          <SplitBar items={cats} />
        </Card>
      ) : null}

      <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
        {apps.map((a, i) => (
          <AppUsageRow key={a.app} appId={a.app} icon={a.icon} minutes={a.minutes} maxMinutes={max} rank={i + 1} first={i === 0} />
        ))}
      </Card>
    </View>
  );
}

function SitesTab({ q }: { q: any }) {
  if (q.loading) return <TabSkeleton />;
  if (q.error && !q.data) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const data = q.data;
  const sites = (data?.results ?? []) as any[];
  if (sites.length === 0) {
    return <EmptyState icon="globe" title="Web-sayt faoliyati yo‘q" message="Bu davrda brauzer tarixi topilmadi." />;
  }
  const maxV = Math.max(...sites.map((s) => s.visits), 1);
  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 4 }}>
        <Text variant="display" style={{ fontSize: 26 }}>
          {data.total_visits ?? sites.reduce((t: number, s: any) => t + s.visits, 0)} ta tashrif
        </Text>
        <Muted>{sites.length} ta sayt · shu davr</Muted>
      </Card>

      {data?.by_browser?.length ? (
        <Card style={{ gap: 12 }}>
          <SectionHeader title="Brauzerlar" />
          {data.by_browser.map((b: any, i: number) => (
            <View
              key={b.browser}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingTop: i ? 8 : 0,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.border,
              }}
            >
              <Text variant="label" color={colors.body} style={{ textTransform: "capitalize" }}>
                {b.browser}
              </Text>
              <Muted>{b.visits} ta tashrif</Muted>
            </View>
          ))}
        </Card>
      ) : null}

      <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
        {sites.map((s, i) => (
          <WebsiteUsageRow key={s.domain} domain={s.domain} minutes={s.minutes} visits={s.visits} maxVisits={maxV} rank={i + 1} first={i === 0} />
        ))}
      </Card>
    </View>
  );
}

function TimelineTab({ q, isToday }: { q: any; isToday: boolean }) {
  if (q.loading) return <TabSkeleton />;
  if (q.error && !q.data) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  const segments = q.data?.segments ?? [];
  if (segments.length === 0) {
    return <EmptyState icon="calendar" title="Bu kuni faoliyat yo‘q" message="Qurilma o‘chirilgan yoki sinxronlanmagan bo‘lishi mumkin." />;
  }
  const now = new Date();
  return (
    <Card>
      <DayTimeline segments={segments} nowMinute={isToday ? now.getHours() * 60 + now.getMinutes() : null} />
    </Card>
  );
}
