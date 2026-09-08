import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { colors } from "../theme";
import { getWebApp, telegramViewportHeight } from "../lib/telegram";

/**
 * On web (Telegram Mini App or a plain browser) the app is framed to a
 * phone-width column, centred on the page background, and its height tracked
 * to Telegram's stable viewport so the tab bar never sits under Telegram's
 * chrome. On native this is a passthrough.
 */
const MAX_WIDTH = 460;

export function AppFrame({ children }: { children: React.ReactNode }) {
  const [height, setHeight] = useState<number | null>(telegramViewportHeight());

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    // Paint the surrounding page so the letterboxed area matches the app.
    document.body.style.backgroundColor = colors.background;
    document.documentElement.style.backgroundColor = colors.background;

    const update = () => setHeight(telegramViewportHeight());
    update();
    window.addEventListener("resize", update);
    const wa = getWebApp();
    wa?.onEvent?.("viewportChanged", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (Platform.OS !== "web") return <>{children}</>;

  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: MAX_WIDTH,
          height: height ?? undefined,
          backgroundColor: colors.background,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}
