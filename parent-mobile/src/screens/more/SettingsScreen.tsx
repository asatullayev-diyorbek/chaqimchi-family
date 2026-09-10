import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { changePassword, updateProfile } from "../../api/auth";
import { useSession } from "../../state/session";
import { ThemePref, useTheme } from "../../state/theme";
import { Icon } from "../../components/Icon";
import {
  Button,
  Card,
  ErrorText,
  Field,
  ListRow,
  Muted,
  Screen,
  Sheet,
  Text,
  useToast,
} from "../../components";

const THEME_OPTIONS: { pref: ThemePref; label: string; icon: "settings" | "sun" | "moon" }[] = [
  { pref: "system", label: "Tizim bo‘yicha", icon: "settings" },
  { pref: "light", label: "Yorug‘", icon: "sun" },
  { pref: "dark", label: "Qorong‘i", icon: "moon" },
];

export default function SettingsScreen() {
  const toast = useToast();
  const { user, refreshUser } = useSession();
  const { pref, setPref } = useTheme();

  const [themeOpen, setThemeOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saveName = useCallback(async () => {
    setBusy(true);
    try {
      await updateProfile(fullName.trim());
      await refreshUser();
      toast.success("Saqlandi");
      setNameOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }, [fullName, refreshUser, toast]);

  const savePw = useCallback(async () => {
    if (newPw.length < 8) {
      setError("Yangi parol kamida 8 ta belgi.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(user?.has_password ? oldPw : "", newPw);
      toast.success("Parol yangilandi");
      setPwOpen(false);
      setOldPw("");
      setNewPw("");
    } catch (e: any) {
      setError(e?.message ?? "Yangilanmadi");
    } finally {
      setBusy(false);
    }
  }, [newPw, oldPw, user?.has_password, toast]);

  return (
    <Screen scroll>
      <Card padded={false}>
        <View style={{ padding: 16, paddingBottom: 4 }}>
          <Text variant="h3">Hisob</Text>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow
            first
            icon="user"
            title="Ism"
            subtitle={user?.full_name || "Kiritilmagan"}
            onPress={() => {
              setFullName(user?.full_name ?? "");
              setNameOpen(true);
            }}
          />
          <ListRow icon="mail" title="Email" subtitle={user?.email || "—"} />
          <ListRow
            icon="key"
            title={user?.has_password ? "Parolni o‘zgartirish" : "Parol o‘rnatish"}
            onPress={() => setPwOpen(true)}
          />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ padding: 16, paddingBottom: 4 }}>
          <Text variant="h3">Ilova</Text>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow first icon="info" title="Til" subtitle="O‘zbekcha" right={<Muted>Yagona</Muted>} />
          <ListRow
            icon="sun"
            title="Ko‘rinish"
            subtitle={THEME_OPTIONS.find((o) => o.pref === pref)?.label}
            onPress={() => setThemeOpen(true)}
          />
          <ListRow icon="info" title="Versiya" right={<Muted>0.1.0</Muted>} />
        </View>
      </Card>

      <Sheet visible={themeOpen} onClose={() => setThemeOpen(false)} title="Ko‘rinish" scroll={false}>
        <View>
          {THEME_OPTIONS.map((o) => (
            <ListRow
              key={o.pref}
              first={o.pref === "system"}
              icon={o.icon}
              title={o.label}
              right={
                pref === o.pref ? <Icon name="check" size={18} color={colors.blue} /> : undefined
              }
              onPress={() => {
                setPref(o.pref);
                setThemeOpen(false);
              }}
            />
          ))}
          <Muted style={{ marginTop: 8 }}>
            «Tizim bo‘yicha» — Telegram yoki telefon mavzusiga moslashadi.
          </Muted>
        </View>
      </Sheet>

      <Sheet visible={nameOpen} onClose={() => setNameOpen(false)} title="Ism" scroll={false}>
        <View style={{ gap: 14 }}>
          <Field value={fullName} onChangeText={setFullName} placeholder="To‘liq ism" />
          <Button title="Saqlash" onPress={saveName} loading={busy} />
        </View>
      </Sheet>

      <Sheet
        visible={pwOpen}
        onClose={() => setPwOpen(false)}
        title={user?.has_password ? "Parolni o‘zgartirish" : "Parol o‘rnatish"}
        scroll={false}
      >
        <View style={{ gap: 14 }}>
          {user?.has_password ? (
            <Field label="Joriy parol" secureTextEntry value={oldPw} onChangeText={setOldPw} />
          ) : null}
          <Field label="Yangi parol" hint="Kamida 8 ta belgi" secureTextEntry value={newPw} onChangeText={setNewPw} />
          <ErrorText message={error} />
          <Button title="Saqlash" onPress={savePw} loading={busy} />
        </View>
      </Sheet>
    </Screen>
  );
}
