import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { childAge } from "../../lib/format";
import { deleteChild, updateChild } from "../../api/children";
import { useFamily } from "../../state/family";
import {
  Avatar,
  Button,
  Card,
  ConfirmSheet,
  DeviceCard,
  EmptyState,
  ErrorState,
  Field,
  ListRow,
  Muted,
  Screen,
  Sheet,
  Text,
  useToast,
} from "../../components";

export default function ChildDetailScreen({ route, navigation }: any) {
  const { childId } = route.params as { childId: string };
  const toast = useToast();
  const { children, linkedDevices, setChild, reload } = useFamily();
  const child = children.find((c) => c.id === childId) ?? null;
  const devices = linkedDevices.filter((d) => d.child_id === childId);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      await updateChild(childId, { name: name.trim(), birth_date: birthDate.trim() || undefined });
      await reload();
      toast.success("Saqlandi");
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }, [childId, name, birthDate, reload, toast]);

  const remove = useCallback(async () => {
    setBusy(true);
    try {
      await deleteChild(childId);
      await reload();
      toast.success("Farzand o‘chirildi");
      navigation.goBack();
    } catch (e: any) {
      toast.error(e?.message ?? "O‘chirilmadi");
      setBusy(false);
    }
  }, [childId, reload, toast, navigation]);

  if (!child) {
    return (
      <Screen>
        <ErrorState message="Farzand topilmadi" onRetry={() => navigation.goBack()} />
      </Screen>
    );
  }

  const age = childAge(child.birth_date);

  return (
    <Screen scroll>
      <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
        <Avatar name={child.name} photoUrl={child.photo_url} seed={child.id} size={72} />
        <Text variant="h2">{child.name}</Text>
        <Muted>
          {age != null ? `${age} yosh · ` : ""}
          {devices.length} ta qurilma
        </Muted>
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          title="Faoliyat"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => {
            setChild(childId);
            navigation.navigate("ActivityTab");
          }}
        />
        <Button
          title="Qoidalar"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => {
            setChild(childId);
            navigation.navigate("RulesTab");
          }}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Text variant="h3">Qurilmalar</Text>
        {devices.length === 0 ? (
          <EmptyState
            icon="device"
            title="Qurilma yo‘q"
            message={`${child.name} uchun qurilma ulang.`}
            action={{ label: "Qurilma ulash", onPress: () => navigation.navigate("PairDevice", { childId }) }}
          />
        ) : (
          <>
            {devices.map((d) => (
              <DeviceCard key={d.id} device={d} onPress={() => navigation.navigate("DeviceDetail", { deviceId: d.id })} />
            ))}
            <Button title="Qurilma ulash" icon="plus" variant="ghost" onPress={() => navigation.navigate("PairDevice", { childId })} />
          </>
        )}
      </View>

      <Card padded={false}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow
            first
            icon="edit"
            title="Ma’lumotni tahrirlash"
            onPress={() => {
              setName(child.name);
              setBirthDate(child.birth_date ?? "");
              setEditOpen(true);
            }}
          />
          <ListRow icon="trash" title="Farzandni o‘chirish" danger onPress={() => setConfirmDelete(true)} />
        </View>
      </Card>

      <Sheet visible={editOpen} onClose={() => setEditOpen(false)} title="Ma’lumotni tahrirlash" scroll={false}>
        <View style={{ gap: 14 }}>
          <Field label="Ism" value={name} onChangeText={setName} />
          <Field label="Tug‘ilgan sana" value={birthDate} onChangeText={setBirthDate} placeholder="2014-05-20" autoCapitalize="none" />
          <Button title="Saqlash" onPress={save} loading={busy} />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Farzandni o‘chirasizmi?"
        message="Farzand va uning qoidalari o‘chiriladi. Ulangan qurilmalar biriktirilmagan holatga o‘tadi."
        confirmLabel="O‘chirish"
        destructive
        loading={busy}
      />
    </Screen>
  );
}
