import React, { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { colors, radius } from "../../theme";
import { formatMinutes } from "../../lib/format";
import { appDisplay } from "../../lib/appDisplay";
import { useFamily } from "../../state/family";
import {
  blockedApps,
  blockedWindows,
  createRule,
  dailyLimitRule,
  deleteRule,
  getRules,
  Rule,
} from "../../api/rules";
import { useQuery } from "../../hooks/useQuery";
import {
  Button,
  Card,
  TabHeader,
  ComingSoonCard,
  ConfirmSheet,
  DurationPickerSheet,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  IconButton,
  ListRow,
  LoadingState,
  Muted,
  Screen,
  Sheet,
  Text,
  TimeRangePickerSheet,
  useToast,
} from "../../components";

export default function RulesScreen({ navigation }: any) {
  const toast = useToast();
  const { childDevices, activeDevice, setDevice, loading: familyLoading } = useFamily();

  // Rules always target one device. If the child has several and none is
  // picked, default to the first so the screen is never empty.
  const deviceId = activeDevice?.id ?? childDevices[0]?.id ?? "";

  const { data, loading, error, refetch, refreshing, reload } = useQuery(
    () => getRules(deviceId),
    [deviceId],
    { enabled: Boolean(deviceId) },
  );
  const rules = data ?? [];

  const [limitOpen, setLimitOpen] = useState<"weekday" | "weekend" | null>(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const [appName, setAppName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Rule | null>(null);
  const [busy, setBusy] = useState(false);

  const limit = dailyLimitRule(rules);
  const weekdayMin = limit?.value.minutes ?? 0;
  const weekendMin = limit?.value.weekend_minutes ?? 0;
  const apps = blockedApps(rules);
  const windows = blockedWindows(rules);

  const saveLimit = useCallback(
    async (which: "weekday" | "weekend", minutes: number) => {
      setBusy(true);
      try {
        const nextValue: { minutes: number; weekend_minutes?: number } = {
          minutes: which === "weekday" ? minutes : weekdayMin || minutes,
        };
        const we = which === "weekend" ? minutes : weekendMin;
        if (we > 0) nextValue.weekend_minutes = we;

        if (which === "weekday" && minutes === 0) {
          if (limit) await deleteRule(limit.id);
        } else {
          const created = await createRule(deviceId, "daily_limit_minutes", nextValue);
          if (limit) await deleteRule(limit.id).catch(() => undefined);
          void created;
        }
        await reload();
        toast.success("Limit saqlandi");
      } catch (e: any) {
        toast.error(e?.message ?? "Saqlanmadi");
      } finally {
        setBusy(false);
        setLimitOpen(null);
      }
    },
    [deviceId, limit, weekdayMin, weekendMin, reload, toast],
  );

  const addApp = useCallback(async () => {
    const name = appName.trim();
    if (!name) return;
    if (apps.some((r) => r.value.app.toLowerCase() === name.toLowerCase())) {
      toast.error("Bu ilova allaqachon cheklangan");
      return;
    }
    setBusy(true);
    try {
      await createRule(deviceId, "blocked_app", { app: name });
      await reload();
      setAppName("");
      setAppOpen(false);
      toast.success("Ilova cheklandi");
    } catch (e: any) {
      toast.error(e?.message ?? "Qo‘shilmadi");
    } finally {
      setBusy(false);
    }
  }, [appName, apps, deviceId, reload, toast]);

  const addWindow = useCallback(
    async (start: string, end: string) => {
      setBusy(true);
      try {
        await createRule(deviceId, "blocked_window", { start, end });
        await reload();
        setWindowOpen(false);
        toast.success("Tinch soat qo‘shildi");
      } catch (e: any) {
        toast.error(e?.message ?? "Qo‘shilmadi");
      } finally {
        setBusy(false);
      }
    },
    [deviceId, reload, toast],
  );

  const removeRule = useCallback(async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await deleteRule(confirmDelete.id);
      await reload();
      toast.success("Qoida o‘chirildi");
    } catch (e: any) {
      toast.error(e?.message ?? "O‘chirilmadi");
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }, [confirmDelete, reload, toast]);

  const header = (
    <View style={{ gap: 12 }}>
      <TabHeader
        title="Qoidalar"
        childSwitcher
        onAddChild={() => navigation.navigate("HomeTab", { screen: "AddChild" })}
      />
      {childDevices.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {childDevices.map((d) => {
            const active = d.id === deviceId;
            return (
              <Pressable
                key={d.id}
                onPress={() => setDevice(d.id)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.blue : colors.border,
                  backgroundColor: active ? colors.blueSoft : colors.surface,
                }}
              >
                <Text variant="micro" color={active ? colors.blue : colors.muted}>
                  {d.child_name || (d.platform === "windows" ? "Kompyuter" : d.platform)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  if (familyLoading || (loading && deviceId)) {
    return (
      <Screen scroll>
        {header}
        <LoadingState />
      </Screen>
    );
  }
  if (!deviceId) {
    return (
      <Screen scroll>
        {header}
        <EmptyState icon="device" title="Qurilma yo‘q" message="Qoida qo‘yish uchun avval farzand qurilmasini ulang." />
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

      {/* Daily limit */}
      <Card padded={false}>
        <View style={{ padding: 16, gap: 3 }}>
          <Text variant="h3">Kunlik ekran vaqti</Text>
          <Muted>O‘zgarishlar keyingi sinxronizatsiyada qurilmaga yetadi.</Muted>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow
            first
            icon="clock"
            title="Ish kunlari"
            subtitle={weekdayMin ? "Dushanba–Juma" : "Belgilanmagan"}
            right={<Text variant="label" color={colors.blue}>{weekdayMin ? formatMinutes(weekdayMin) : "Qo‘shish"}</Text>}
            onPress={() => setLimitOpen("weekday")}
          />
          <ListRow
            icon="calendar"
            title="Dam olish kunlari"
            subtitle={weekendMin ? "Shanba–Yakshanba" : "Ish kunlari limiti qo‘llanadi"}
            right={<Text variant="label" color={colors.blue}>{weekendMin ? formatMinutes(weekendMin) : "Qo‘shish"}</Text>}
            onPress={() => (weekdayMin ? setLimitOpen("weekend") : toast.error("Avval ish kunlari limitini belgilang"))}
          />
        </View>
      </Card>

      {/* Blocked apps */}
      <Card padded={false}>
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 3, flex: 1 }}>
            <Text variant="h3">Cheklangan ilovalar</Text>
            <Muted>Farzand ilovada «hozircha mavjud emas» ko‘rinishida bo‘ladi.</Muted>
          </View>
          <IconButton name="plusCircle" onPress={() => setAppOpen(true)} accessibilityLabel="Ilova qo‘shish" color={colors.blue} />
        </View>
        {apps.length === 0 ? (
          <View style={{ padding: 16, paddingTop: 0 }}>
            <Muted>Hali cheklangan ilova yo‘q.</Muted>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {apps.map((r, i) => (
              <ListRow
                key={r.id}
                first={i === 0}
                icon="shieldOff"
                iconColor={colors.danger}
                iconBg={colors.dangerSoft}
                title={appDisplay(r.value.app).label}
                right={<IconButton name="trash" onPress={() => setConfirmDelete(r)} accessibilityLabel="O‘chirish" color={colors.faint} size={17} />}
              />
            ))}
          </View>
        )}
      </Card>

      {/* Quiet hours */}
      <Card padded={false}>
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 3, flex: 1 }}>
            <Text variant="h3">Tinch soatlar</Text>
            <Muted>Uyqu vaqti yoki dars vaqti — belgilangan oraliqda ekran bloklanadi.</Muted>
          </View>
          <IconButton name="plusCircle" onPress={() => setWindowOpen(true)} accessibilityLabel="Oyna qo‘shish" color={colors.blue} />
        </View>
        {windows.length === 0 ? (
          <View style={{ padding: 16, paddingTop: 0 }}>
            <Muted>Hali tinch soat belgilanmagan.</Muted>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {windows.map((r, i) => (
              <ListRow
                key={r.id}
                first={i === 0}
                icon="moon"
                iconColor={colors.catPurple}
                iconBg={colors.catPurpleBg}
                title={`${r.value.start} – ${r.value.end}`}
                right={<IconButton name="trash" onPress={() => setConfirmDelete(r)} accessibilityLabel="O‘chirish" color={colors.faint} size={17} />}
              />
            ))}
          </View>
        )}
      </Card>

      <ComingSoonCard
        icon="app"
        title="Ilovaga vaqt limiti"
        message="Bitta ilovaga alohida kunlik limit (masalan, YouTube — 45 daqiqa). Hozircha faqat umumiy limit va to‘liq blok mavjud."
      />
      <ComingSoonCard
        icon="globe"
        title="Web-sayt qoidalari"
        message="Alohida saytlarni bloklash yoki cheklash. Hozircha web-saytlar faqat kuzatiladi."
      />
      <ComingSoonCard
        icon="lock"
        title="Darhol bloklash / Internetni to‘xtatish"
        message="Bir tugma bilan qurilmani zudlik bilan bloklash. Hozircha qoidalar keyingi sinxronizatsiyada yetadi."
      />

      {/* Sheets */}
      <DurationPickerSheet
        visible={limitOpen === "weekday"}
        onClose={() => setLimitOpen(null)}
        onSubmit={(m) => saveLimit("weekday", m)}
        title="Ish kunlari limiti"
        initial={weekdayMin}
        loading={busy}
      />
      <DurationPickerSheet
        visible={limitOpen === "weekend"}
        onClose={() => setLimitOpen(null)}
        onSubmit={(m) => saveLimit("weekend", m)}
        title="Dam olish kunlari limiti"
        initial={weekendMin || weekdayMin}
        loading={busy}
      />
      <TimeRangePickerSheet
        visible={windowOpen}
        onClose={() => setWindowOpen(false)}
        onSubmit={addWindow}
        title="Tinch soat"
        loading={busy}
      />
      <Sheet visible={appOpen} onClose={() => setAppOpen(false)} title="Ilovani cheklash" scroll={false}>
        <View style={{ gap: 14 }}>
          <Field
            label="Ilova nomi"
            hint="Ilova nomini yozing, masalan: Steam, Roblox, Discord"
            autoCapitalize="none"
            value={appName}
            onChangeText={setAppName}
            onSubmitEditing={addApp}
          />
          <Button title="Cheklash" onPress={addApp} loading={busy} disabled={!appName.trim()} />
        </View>
      </Sheet>
      <ConfirmSheet
        visible={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={removeRule}
        title="Qoidani o‘chirasizmi?"
        message="Bu cheklov olib tashlanadi va keyingi sinxronizatsiyada qurilmada ham bekor bo‘ladi."
        confirmLabel="O‘chirish"
        destructive
        loading={busy}
      />
    </Screen>
  );
}
