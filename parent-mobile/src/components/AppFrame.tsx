import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { colors } from "../theme";
import { onTelegramLayoutChange, telegramInsets, telegramViewportHeight } from "../lib/telegram";

/**
 * On web (Telegram Mini App or a plain browser) the app is framed to a
 * phone-width column, centred on the page background, its height tracked to
 * Telegram's stable viewport, and padded to clear Telegram's floating
 * header / device safe area. On native this is a passthrough.
 */
const MAX_WIDTH = 460;

export function AppFrame({ children }: { children: React.ReactNode }) {
  const [layout, setLayout] = useState(() => ({
    height: telegramViewportHeight(),
    insets: telegramInsets(),
  }));

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    document.body.style.backgroundColor = colors.background;
    document.documentElement.style.backgroundColor = colors.background;

    const update = () =>
      setLayout({ height: telegramViewportHeight(), insets: telegramInsets() });
    update();
    window.addEventListener("resize", update);
    const unsubscribe = onTelegramLayoutChange(update);
    return () => {
      window.removeEventListener("resize", update);
      unsubscribe();
    };
  }, []);

  if (Platform.OS !== "web") return <>{children}</>;

  const { height, insets } = layout;

  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: MAX_WIDTH,
          height: height ?? undefined,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: colors.background,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}
