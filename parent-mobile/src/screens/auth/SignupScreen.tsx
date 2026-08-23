import React, { useState } from "react";
import { Text, View } from "react-native";
import { login, signup } from "../../api/auth";
import { resolvePostLoginRoute } from "../../api/tracking";
import { Card, ErrorText, Field, PrimaryButton, SecondaryButton, colors, Screen } from "../../ui";

export default function SignupScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    try {
      setSubmitting(true);
      setError(null);
      await signup(email.trim(), password);
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
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>Yangi hisob</Text>
          <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>Avval ota-ona hisobini yarating, keyin child qurilmasini ulang.</Text>
        </View>
        <Card style={{ gap: 13 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Ro‘yxatdan o‘tish</Text>
          <Field placeholder="Email manzil" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Field placeholder="Parol (kamida 8 belgi)" autoComplete="new-password" secureTextEntry value={password} onChangeText={setPassword} />
          <ErrorText message={error} />
          <PrimaryButton title="Hisob yaratish" onPress={onSubmit} loading={submitting} />
        </Card>
        <SecondaryButton title="Kirish sahifasiga qaytish" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}
