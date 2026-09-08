import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { colors } from "../../theme";
import { login, telegramStart, telegramStatus } from "../../api/auth";
import { getInitData, isTelegramWebApp } from "../../lib/telegram";
import { useSession } from "../../state/session";
import {
  Button,
  Card,
  Divider,
  ErrorText,
  Field,
  Icon,
  Screen,
  Spino24Badge,
  Text,
} from "../../components";

export default function LoginScreen({ navigation }: any) {
  const { onAuthenticated, retryTelegram } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      await onAuthenticated();
    } catch (e: any) {
      setError(e?.message ?? "Kirishda xatolik");
      setBusy(false);
    }
  }

  async function startTelegram() {
    if (tgBusy) return;
    setTgBusy(true);
    setError(null);

    // Inside a Telegram Mini App there's no browser tab to bounce through —
    // log in directly from the signed initData.
    if (isTelegramWebApp()) {
      try {
        await retryTelegram();
      } catch (e: any) {
        setTgBusy(false);
        setError(e?.message ?? "Telegram orqali kirib bo‘lmadi");
      }
      return;
    }

    try {
      const { token, bot_url } = await telegramStart();
      await Linking.openURL(bot_url);
      poll.current = setInterval(async () => {
        try {
          const s = await telegramStatus(token);
          if (s.status === "linked") {
            if (poll.current) clearInterval(poll.current);
            await onAuthenticated();
          } else if (s.status === "expired" || s.status === "rejected") {
            if (poll.current) clearInterval(poll.current);
            setTgBusy(false);
            setError(s.status === "rejected" ? "Telegram orqali kirish rad etildi." : "Kod muddati tugadi.");
          }
        } catch {
          /* keep polling */
        }
      }, 2500);
    } catch (e: any) {
      setTgBusy(false);
      setError(e?.message ?? "Telegram ochilmadi");
    }
  }

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: 22, paddingVertical: 30 }}>
        <View style={{ gap: 10 }}>
          <Spino24Badge size={52} />
          <Text variant="display" style={{ marginTop: 6 }}>
            Xush kelibsiz
          </Text>
          <Text variant="bodyLg" color={colors.muted}>
            Farzandingizning raqamli odatlarini birga boshqaring.
          </Text>
        </View>

        <Card style={{ gap: 14 }}>
          <Field
            label="Foydalanuvchi nomi yoki email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={identifier}
            onChangeText={setIdentifier}
          />
          <Field label="Parol" secureTextEntry value={password} onChangeText={setPassword} />
          <Pressable onPress={() => navigation.navigate("ForgotPassword")} hitSlop={8}>
            <Text variant="caption" color={colors.blue}>
              Parolni unutdingizmi?
            </Text>
          </Pressable>
          <ErrorText message={error} />
          <Button title="Kirish" onPress={submit} loading={busy} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Divider style={{ flex: 1 }} />
            <Text variant="micro" color={colors.faint}>
              YOKI
            </Text>
            <Divider style={{ flex: 1 }} />
          </View>
          <Button
            title="Telegram orqali kirish"
            variant="secondary"
            icon="telegram"
            onPress={startTelegram}
            loading={tgBusy}
          />
        </Card>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
          <Text variant="caption" color={colors.muted}>
            Hisobingiz yo‘qmi?
          </Text>
          <Pressable onPress={() => navigation.navigate("Register")} hitSlop={8}>
            <Text variant="caption" color={colors.blue}>
              Ro‘yxatdan o‘tish
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
