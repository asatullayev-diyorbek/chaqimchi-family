import React, { useState } from "react";
import { Text, View } from "react-native";
import { login } from "../../api/auth";
import { resolvePostLoginRoute } from "../../api/tracking";
import { Card, ErrorText, Field, PrimaryButton, SecondaryButton, colors, Screen } from "../../ui";

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    try {
      setSubmitting(true);
      setError(null);
      await login(email.trim(), password);
      navigation.replace(await resolvePostLoginRoute());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: 22, paddingVertical: 34 }}>
        <View style={{ gap: 7 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 23, fontWeight: "800" }}>C</Text></View>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800", marginTop: 10 }}>Xush kelibsiz</Text>
          <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>Farzandingizning raqamli odatlarini birga boshqaring.</Text>
        </View>
        <Card style={{ gap: 13 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Hisobingizga kiring</Text>
          <Field placeholder="Email manzil" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Field placeholder="Parol" autoComplete="current-password" secureTextEntry value={password} onChangeText={setPassword} />
          <ErrorText message={error} />
          <PrimaryButton title="Kirish" onPress={onSubmit} loading={submitting} />
        </Card>
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>Hali hisobingiz yo‘qmi?</Text>
          <SecondaryButton title="Ro‘yxatdan o‘tish" onPress={() => navigation.navigate("Signup")} />
        </View>
      </View>
    </Screen>
  );
}
