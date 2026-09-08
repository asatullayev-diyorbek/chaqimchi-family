import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { colors } from "../theme";
import {
  clearTokens,
  hasSession,
  hydrateTokens,
  setSessionExpiredHandler,
} from "../api/client";
import { CurrentUser, getCurrentUser, logout as apiLogout, telegramWebAppLogin } from "../api/auth";
import {
  getInitData,
  initTelegramUI,
  isTelegramWebApp,
  loadTelegramSdk,
} from "../lib/telegram";
import { storageGet, storageSet } from "../platform/storage";

const SEEN_KEY = "spino24_seen";
// On a brand-new install/open, hold the splash at least this long so the
// Spino24 launch moment is visible even though auto-login is near-instant.
const FIRST_RUN_SPLASH_MS = 1600;

type SessionState = {
  status: "loading" | "signedOut" | "signedIn";
  user: CurrentUser | null;
  /** True inside Telegram — the auth stack hides its email/password forms. */
  viaTelegram: boolean;
  /** Call after a manual login/signup so the tree flips to the app. */
  onAuthenticated: () => Promise<void>;
  /** Retry Telegram auto-login (used if the first attempt failed). */
  retryTelegram: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionState["status"]>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [viaTelegram, setViaTelegram] = useState(false);
  const mounted = useRef(true);

  const loadUser = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      if (mounted.current) {
        setUser(me);
        setStatus("signedIn");
      }
    } catch {
      if (mounted.current) {
        setUser(null);
        setStatus(hasSession() ? "signedIn" : "signedOut");
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      await loadTelegramSdk();
      initTelegramUI(colors.background);
      const inTelegram = isTelegramWebApp();
      if (mounted.current) setViaTelegram(inTelegram);

      const firstRun = (await storageGet(SEEN_KEY)) === null;
      const splashFloor = firstRun ? sleep(FIRST_RUN_SPLASH_MS) : Promise.resolve();

      const had = await hydrateTokens();
      if (had) {
        await loadUser();
      } else if (inTelegram) {
        // Silent auto-login from the Telegram-signed initData.
        try {
          await telegramWebAppLogin(getInitData());
          await loadUser();
        } catch {
          if (mounted.current) setStatus("signedOut");
        }
      } else if (mounted.current) {
        setStatus("signedOut");
      }

      await splashFloor;
      await storageSet(SEEN_KEY, "1");
    })();
    return () => {
      mounted.current = false;
    };
  }, [loadUser]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (!mounted.current) return;
      setUser(null);
      setStatus("signedOut");
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const onAuthenticated = useCallback(async () => {
    setStatus("loading");
    await loadUser();
  }, [loadUser]);

  const retryTelegram = useCallback(async () => {
    setStatus("loading");
    try {
      await telegramWebAppLogin(getInitData());
      await loadUser();
    } catch {
      if (mounted.current) setStatus("signedOut");
    }
  }, [loadUser]);

  const signOut = useCallback(async () => {
    await apiLogout();
    await clearTokens();
    setUser(null);
    // Inside Telegram there is nothing to sign out to — re-auth on next open.
    setStatus("signedOut");
  }, []);

  const value = useMemo<SessionState>(
    () => ({ status, user, viaTelegram, onAuthenticated, retryTelegram, signOut, refreshUser: loadUser }),
    [status, user, viaTelegram, onAuthenticated, retryTelegram, signOut, loadUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
