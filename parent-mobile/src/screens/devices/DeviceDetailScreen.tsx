import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { formatDate, relativeTime } from "../../lib/format";
import { useFamily } from "../../state/family";
import { getSummary, unlinkDevice, updateDevice } from "../../api/tracking";
import { useQuery } from "../../hooks/useQuery";
import ScreenshotPanel from "./ScreenshotPanel";
import {
  Button,
  Card,
  ConfirmSheet,
  ErrorState,
  Field,
  ListRow,
  LoadingState,
  Muted,
  PlatformBadge,
  Screen,
  Sheet,
  StatusDot,
  Text,
  useToast,
  BatteryGauge,
  batteryColor,
} from "../../components";

export default function DeviceDetailScreen({ route, navigation }: any) {
  const { deviceId } = route.params as { deviceId: string };
  const toast = useToast();
  const { devices, children, reload } = useFamily();
  const device = devices.find((d) => d.id === deviceId) ?? null;

  const { data: summary, loading, error, refetch, refreshing } = useQuery(
    () => getSummary(deviceId),
    [deviceId],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveName = useCallback(async () => {
    setBusy(true);
    try {
      await updateDevice(deviceId, { child_name: name.trim() });
      await reload();
      toast.success("Nomi yangilandi");
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }, [deviceId, name, reload, toast]);

  const assignOwner = useCallback(
    async (childId: string | null) => {
      setBusy(true);
      try {
        await updateDevice(deviceId, { child_id: childId });
        await reload();
        toast.success("Egasi yangilandi");
        setOwnerOpen(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Saqlanmadi");
      } finally {
        setBusy(false);
      }
    },
    [deviceId, reload, toast],
  );

  const doUnlink = useCallback(async () => {
    setBusy(true);
    try {
      await unlinkDevice(deviceId);
      await reload();
      toast.success("Qurilma uzildi");
      navigation.goBack();
    } catch (e: any) {
      toast.error(e?.message ?? "Uzilmadi");
      setBusy(false);
    }
  }, [deviceId, reload, toast, navigation]);

  if (!device) {
    return (
      <Screen>
        <ErrorState message="Qurilma topilmadi" onRetry={() => navigation.goBack()} />
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

  const online = summary?.device_status === "online";
  const owner = children.find((c) => c.id === device.child_id);

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: colors.blueSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text variant="h2" color={colors.blue}>
              {(device.child_name || "?")[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="h2">{device.child_name || "Qurilma"}</Text>
            <PlatformBadge platform={device.platform} />
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <StatusDot online={online} />
          <Muted>
            {online ? "Onlayn" : `Oxirgi aloqa: ${relativeTime(summary?.last_sync ?? device.last_sync)}`}
          </Muted>
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ padding: 16, paddingBottom: 4 }}>
          <Text variant="h3">Ma’lumot</Text>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          {typeof summary?.battery_percent === "number" ? (
            <ListRow
              first
              icon="battery"
              title="Batareya"
              subtitle={formatDate(summary.battery_updated_at ?? "", true)}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <BatteryGauge level={summary.battery_percent} width={26} />
                  <Text variant="label" color={batteryColor(summary.battery_percent)}>
                    {summary.battery_percent}%
                  </Text>
                </View>
              }
            />
          ) : null}
          <ListRow
            first={typeof summary?.battery_percent !== "number"}
            icon="device"
            title="Platforma"
            right={<Text variant="label">{device.platform === "windows" ? "Windows" : device.platform}</Text>}
          />
          <ListRow
            icon="refresh"
            title="Dastur versiyasi"
            right={<Text variant="label">{device.agent_version ? `v${device.agent_version}` : "—"}</Text>}
          />
          <ListRow
            icon="link"
            title="Ulangan sana"
            right={<Text variant="label">{device.linked_at ? formatDate(device.linked_at) : "—"}</Text>}
          />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ padding: 16, paddingBottom: 4 }}>
          <Text variant="h3">Boshqarish</Text>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow
            first
            icon="edit"
            title="Qurilma nomini o‘zgartirish"
            onPress={() => {
              setName(device.child_name || "");
              setEditOpen(true);
            }}
          />
          <ListRow
            icon="users"
            title="Egasini o‘zgartirish"
            subtitle={owner ? owner.name : "Biriktirilmagan"}
            onPress={() => setOwnerOpen(true)}
          />
          <ListRow
            icon="rules"
            title="Qoidalar"
            onPress={() => navigation.navigate("RulesTab")}
          />
          <ListRow icon="trash" title="Qurilmani uzish" danger onPress={() => setConfirmUnlink(true)} />
        </View>
      </Card>

      <ScreenshotPanel deviceId={deviceId} online={online} />

      <Muted style={{ textAlign: "center" }}>
        «Darhol bloklash» va «Internetni to‘xtatish» kabi tezkor buyruqlar hozircha mavjud emas — qoidalar
        keyingi sinxronizatsiyada qurilmaga yetadi.
      </Muted>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title="Qurilma nomi" scroll={false}>
        <View style={{ gap: 14 }}>
          <Field value={name} onChangeText={setName} placeholder="Masalan: Alining noutbuki" />
          <Button title="Saqlash" onPress={saveName} loading={busy} />
        </View>
      </Sheet>

      <Sheet visible={ownerOpen} onClose={() => setOwnerOpen(false)} title="Egasini tanlang" scroll={false}>
        <View style={{ gap: 2 }}>
          {children.map((c) => (
            <ListRow
              key={c.id}
              first
              title={c.name}
              right={device.child_id === c.id ? <Text variant="label" color={colors.blue}>Joriy</Text> : undefined}
              onPress={() => assignOwner(c.id)}
            />
          ))}
          <ListRow title="Biriktirmaslik" danger onPress={() => assignOwner(null)} />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={confirmUnlink}
        onClose={() => setConfirmUnlink(false)}
        onConfirm={doUnlink}
        title="Qurilmani uzasizmi?"
        message="Qurilma hisobingizdan uziladi. Yig‘ilgan faoliyat tarixi saqlanib qoladi va keyin qayta ulash mumkin."
        confirmLabel="Uzish"
        destructive
        loading={busy}
      />
    </Screen>
  );
}
