import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { ReviewSheet } from "../components/ReviewSheet";

type ReviewState = { open: () => void };
const Ctx = createContext<ReviewState | null>(null);

/**
 * Single global review sheet, openable from anywhere (the "Ilovani
 * baholang" row in More, or a deep link). The bot's broadcast button opens
 * the Mini App at "<miniapp url>?open=review" — on web that query string
 * is just window.location.search, so a plain check on mount is enough,
 * no Telegram-specific API needed.
 */
export function ReviewProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("open") === "review") setVisible(true);
    } catch {
      /* no-op — not in a browser-like environment */
    }
  }, []);

  return (
    <Ctx.Provider value={{ open: () => setVisible(true) }}>
      {children}
      <ReviewSheet visible={visible} onClose={() => setVisible(false)} />
    </Ctx.Provider>
  );
}

export function useReview(): ReviewState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useReview must be used inside <ReviewProvider>");
  return ctx;
}
