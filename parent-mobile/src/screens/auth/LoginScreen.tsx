import React, { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { login } from "../../api/auth";

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    try {
      await login(email, password);
      navigation.replace("QRScan");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "600" }}>Kirish</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 }}
      />
      <TextInput
        placeholder="Parol"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 }}
      />
      {error && <Text style={{ color: "red" }}>{error}</Text>}
      <Button title="Kirish" onPress={onSubmit} />
      <Button title="Ro'yxatdan o'tish" onPress={() => navigation.navigate("Signup")} />
    </View>
  );
}
