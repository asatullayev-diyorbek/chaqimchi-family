import React, { useState } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { resetPasswordStart, resetPasswordVerify } from "../../api/auth";
import { Button, Card, ErrorText, Field, Icon, Screen, Text, useToast } from "../../components";

export default function ForgotPasswordScreen({ navigation }: any) {
  const toast = useToast();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request() {
    if (busy || !username.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await resetPasswordStart(username.trim());
      setStep("verify");
    } catch (e: any) {
      setError(e?.message ?? "So‘rov yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (busy) return;
    if (password.length < 8) {
      setError("Yangi parol kamida 8 ta belgidan iborat bo‘lsin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPasswordVerify(username.trim(), code.trim(), password);
      toast.success("Parol yangilandi. Endi kiring.");
      navigation.replace("Login");
    } catch (e: any) {
      setError(e?.message ?? "Kod tasdiqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: 20, paddingVertical: 30 }}>
        <View style={{ gap: 8 }}>
          <Text variant="h1">Parolni tiklash</Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <Icon name="telegram" size={16} color={colors.muted} />
            <Text variant="body" color={colors.muted} style={{ flex: 1 }}>
              Tiklash kodi Telegram hisobingizga yuboriladi. Email yuborilmaydi —
              avval Telegram’ni ulagan bo‘lishingiz kerak.
            </Text>
          </View>
        </View>

        {step === "request" ? (
          <Card style={{ gap: 14 }}>
            <Field
              label="Foydalanuvchi nomi yoki email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={username}
              onChangeText={setUsername}
            />
            <ErrorText message={error} />
            <Button title="Kod yuborish" onPress={request} loading={busy} />
          </Card>
        ) : (
          <Card style={{ gap: 14 }}>
            <Field
              label="Telegram’dagi 6 xonali kod"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              style={{ letterSpacing: 6, textAlign: "center", fontWeight: "800" }}
            />
            <Field label="Yangi parol" secureTextEntry value={password} onChangeText={setPassword} />
            <ErrorText message={error} />
            <Button title="Parolni yangilash" onPress={verify} loading={busy} />
            <Button title="Kodni qayta yuborish" variant="ghost" onPress={request} />
          </Card>
        )}

        <Button title="Kirishga qaytish" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}
