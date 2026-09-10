import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { colors } from "../../theme";
import { useSession } from "../../state/session";
import { openTelegramLink } from "../../lib/telegram";
import { Button, Card, Icon, Screen, Spino24Mascot, Text } from "../../components";

const BOT_URL =
  process.env.EXPO_PUBLIC_BOT_URL || "https://t.me/ChaqimchiGuardBot";

/** Shown after auto-login when the account still owes a phone number
 *  (onboarding_required). The parent finishes in the bot; we re-check on
 *  every return to the foreground. */
export default function OnboardingGate() {
  const { refreshUser } = useSession();
  const [checking, setChecking] = useState(false);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      await refreshUser();
    } finally {
      setChecking(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refreshUser();
    });
    // Web: also re-check when the tab regains focus.
    if (typeof document !== "undefined") {
      const onVis = () => {
        if (document.visibilityState === "visible") refreshUser();
      };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        sub.remove();
        document.removeEventListener("visibilitychange", onVis);
      };
    }
    return () => sub.remove();
  }, [refreshUser]);

  const openBot = () => {
    if (!openTelegramLink(BOT_URL)) Linking.openURL(BOT_URL);
  };

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: 22, paddingVertical: 24 }}>
        <View style={{ alignItems: "center", gap: 14 }}>
          <Spino24Mascot width={130} />
          <Text variant="h2" style={{ textAlign: "center" }}>
            Deyarli tayyor
          </Text>
          <Text
            variant="bodyLg"
            color={colors.muted}
            style={{ textAlign: "center", maxWidth: 320 }}
          >
            Davom etish uchun botga qayting va telefon raqamingizni yuboring.
            Bu hisobingizni himoyalaydi.
          </Text>
        </View>

        <Card style={{ gap: 10 }}>
          {[
            "Botda «📱 Telefon raqamni yuborish» tugmasini bosing",
            "Raqam faqat sizning hisobingizga bog'lanadi",
            "Shundan keyin barcha imkoniyatlar ochiladi",
          ].map((t, i) => (
            <View
              key={t}
              style={{
                flexDirection: "row",
                gap: 10,
                paddingVertical: 10,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.border,
                alignItems: "flex-start",
              }}
            >
              <Icon name="check" size={16} color={colors.brandGreen} />
              <Text variant="body" color={colors.body} style={{ flex: 1 }}>
                {t}
              </Text>
            </View>
          ))}
        </Card>

        <View style={{ gap: 10 }}>
          <Button title="Telegram botni ochish" icon="telegram" onPress={openBot} />
          <Button
            title="Tekshirish"
            variant="ghost"
            icon="refresh"
            loading={checking}
            onPress={recheck}
          />
        </View>
      </View>
    </Screen>
  );
}
