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
  getTelegramUserId,
  initTelegramUI,
  isTelegramWebApp,
  loadTelegramSdk,
} from "../lib/telegram";
import { storageDelete, storageGet, storageSet } from "../platform/storage";

const SEEN_KEY = "spino24_seen";
// Which Telegram account the persisted tokens belong to. Telegram's Mini App
// WebView shares storage across the accounts on one device, so a stored
// session must be re-checked against whoever actually opened the app.
const TG_ID_KEY = "spino24_tg_id";
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

      if (inTelegram) {
        // Inside Telegram, the signed initData is the source of truth for
        // *who* is using the app — a persisted session from another Telegram
        // account on the same device (shared WebView storage) must not carry
        // over.
        const currentTgId = getTelegramUserId();
        const storedTgId = await storageGet(TG_ID_KEY);
        const sameUser = Boolean(storedTgId && currentTgId && storedTgId === currentTgId);
        if (storedTgId && currentTgId && storedTgId !== currentTgId) {
          await clearTokens();
        }
        const had = await hydrateTokens();

        if (had && sameUser) {
          // Fast path: a stored session for this exact Telegram account.
          await loadUser();
        } else {
          try {
            await telegramWebAppLogin(getInitData());
            if (currentTgId) await storageSet(TG_ID_KEY, currentTgId);
            await loadUser();
          } catch {
            if (had && (!storedTgId || !currentTgId || storedTgId === currentTgId)) {
              await loadUser();
            } else if (mounted.current) {
              setStatus("signedOut");
            }
          }
        }
      } else {
        const had = await hydrateTokens();
        if (had) await loadUser();
        else if (mounted.current) setStatus("signedOut");
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
      const id = getTelegramUserId();
      if (id) await storageSet(TG_ID_KEY, id);
      await loadUser();
    } catch {
      if (mounted.current) setStatus("signedOut");
    }
  }, [loadUser]);

  const signOut = useCallback(async () => {
    await apiLogout();
    await clearTokens();
    await storageDelete(TG_ID_KEY);
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
