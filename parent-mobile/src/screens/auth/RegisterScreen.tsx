import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { colors } from "../../theme";
import { login, signup } from "../../api/auth";
import { useSession } from "../../state/session";
import { Button, Card, ErrorText, Field, Screen, Text } from "../../components";

export default function RegisterScreen({ navigation }: any) {
  const { onAuthenticated } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (password.length < 8) {
      setError("Parol kamida 8 ta belgidan iborat bo‘lsin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signup(email.trim(), password);
      await login(email.trim(), password);
      await onAuthenticated();
    } catch (e: any) {
      setError(e?.message ?? "Ro‘yxatdan o‘tishda xatolik");
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: 22, paddingVertical: 30 }}>
        <View style={{ gap: 8 }}>
          <Text variant="display">Yangi hisob</Text>
          <Text variant="bodyLg" color={colors.muted}>
            Avval ota-ona hisobini yarating, keyin farzand qurilmasini ulaysiz.
          </Text>
        </View>

        <Card style={{ gap: 14 }}>
          <Field
            label="Email manzil"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Parol"
            hint="Kamida 8 ta belgi"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <ErrorText message={error} />
          <Button title="Hisob yaratish" onPress={submit} loading={busy} />
        </Card>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
          <Text variant="caption" color={colors.muted}>
            Hisobingiz bormi?
          </Text>
          <Pressable onPress={() => navigation.navigate("Login")} hitSlop={8}>
            <Text variant="caption" color={colors.blue}>
              Kirish
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
