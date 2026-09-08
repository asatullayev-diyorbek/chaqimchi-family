// Telegram Mini App (Web App) integration.
//
// When the parent app is opened inside Telegram, `window.Telegram.WebApp`
// exposes a signed `initData` string plus theme / viewport info. We use
// initData for silent auto-login (verified server-side) and the viewport
// helpers to size the app to Telegram's frame.
//
// Everything here is a no-op off web / outside Telegram, so callers don't
// need platform guards.

import { Platform } from "react-native";

type ThemeParams = {
  bg_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
};

type SafeAreaInset = { top: number; bottom: number; left: number; right: number };

type TelegramWebApp = {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; username?: string } };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: ThemeParams;
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  safeAreaInset?: SafeAreaInset;
  contentSafeAreaInset?: SafeAreaInset;
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent?: (event: string, cb: () => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const SDK_URL = "https://telegram.org/js/telegram-web-app.js";
let sdkPromise: Promise<void> | null = null;

/** Injects the Telegram SDK script (web only). Resolves once, or after a
 *  short timeout so a non-Telegram browser doesn't hang the splash. */
export function loadTelegramSdk(): Promise<void> {
  if (Platform.OS !== "web" || typeof document === "undefined") return Promise.resolve();
  if (window.Telegram?.WebApp) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve) => {
    const done = () => resolve();
    const timer = setTimeout(done, 2500);
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      done();
    };
    script.onerror = () => {
      clearTimeout(timer);
      done();
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function getWebApp(): TelegramWebApp | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/** True only inside a real Telegram client (initData is present and signed). */
export function isTelegramWebApp(): boolean {
  const wa = getWebApp();
  return Boolean(wa && wa.initData && wa.initData.length > 0);
}

export function getInitData(): string {
  return getWebApp()?.initData ?? "";
}

/** ready() + expand(), lock the header/background to the app's page colour,
 *  and stop Telegram's pull-to-close gesture from fighting our scroll. */
export function initTelegramUI(backgroundColor: string): void {
  const wa = getWebApp();
  if (!wa) return;
  try {
    wa.ready();
    wa.expand();
    wa.disableVerticalSwipes?.();
    wa.setHeaderColor?.(backgroundColor);
    wa.setBackgroundColor?.(backgroundColor);
  } catch {
    /* older Telegram clients lack some of these — ignore */
  }
}

/** Stable viewport height inside Telegram, or the window height elsewhere. */
export function telegramViewportHeight(): number | null {
  const wa = getWebApp();
  if (wa?.viewportStableHeight) return wa.viewportStableHeight;
  if (Platform.OS === "web" && typeof window !== "undefined") return window.innerHeight;
  return null;
}

/** Top inset to keep content clear of Telegram's own header controls. */
export function telegramTopInset(): number {
  const wa = getWebApp();
  return wa?.contentSafeAreaInset?.top ?? wa?.safeAreaInset?.top ?? 0;
}
