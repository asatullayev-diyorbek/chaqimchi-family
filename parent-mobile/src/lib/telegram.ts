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
  onEvent?: (event: string, cb: (payload?: any) => void) => void;
  offEvent?: (event: string, cb: (payload?: any) => void) => void;
  showScanQrPopup?: (
    params: { text?: string },
    callback?: (text: string) => boolean | void,
  ) => void;
  closeScanQrPopup?: () => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
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

/** The Telegram user id of whoever opened the Mini App, as a string. */
export function getTelegramUserId(): string | null {
  const id = getWebApp()?.initDataUnsafe?.user?.id;
  return id ? String(id) : null;
}

/** Whether Telegram's native QR scanner is available. */
export function canScanQr(): boolean {
  return typeof getWebApp()?.showScanQrPopup === "function";
}

/** Open a t.me link. Inside Telegram this switches to the bot chat; on a
 *  plain browser / native it's a normal navigation the caller handles. */
export function openTelegramLink(url: string): boolean {
  const wa = getWebApp();
  if (typeof wa?.openTelegramLink === "function") {
    wa.openTelegramLink(url);
    return true;
  }
  return false;
}

/**
 * Open Telegram's native QR scanner. Resolves with the scanned text, or null
 * if the user cancelled / it isn't available.
 */
export function scanQrWithTelegram(prompt = "QR-kodni kameraga tuting"): Promise<string | null> {
  const wa = getWebApp() as any;
  if (typeof wa?.showScanQrPopup !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      wa.offEvent?.("qrTextReceived", onText);
      wa.offEvent?.("scanQrPopupClosed", onClosed);
      resolve(value);
    };
    const onText = (payload: { data?: string }) => {
      wa.closeScanQrPopup?.();
      finish(payload?.data ?? null);
    };
    const onClosed = () => finish(null);
    wa.onEvent?.("qrTextReceived", onText);
    wa.onEvent?.("scanQrPopupClosed", onClosed);
    wa.showScanQrPopup({ text: prompt }, (text: string) => {
      finish(text);
      return true;
    });
  });
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

/**
 * Padding to keep content clear of Telegram's chrome: the device safe area
 * (notch) plus Telegram's own floating header/menu controls. Bot API < 8.0
 * has no `contentSafeAreaInset` — fall back to a header-sized top inset so
 * the app title row isn't hidden under the close/menu pills.
 */
export function telegramInsets(): { top: number; bottom: number } {
  const wa = getWebApp();
  if (!wa || !isTelegramWebApp()) return { top: 0, bottom: 0 };
  const safe = wa.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const content = wa.contentSafeAreaInset;
  // Bot API 8.0+ reports the exact inset from Telegram's chrome — trust it
  // whenever the field exists (0 is a valid value, e.g. Telegram Desktop).
  // Older clients have no such field; reserve room for the floating header.
  const top = content ? safe.top + content.top : safe.top + 44;
  return { top, bottom: safe.bottom + (content?.bottom ?? 0) };
}

/** Subscribe to every event that can change the viewport or insets. */
export function onTelegramLayoutChange(cb: () => void): () => void {
  const wa = getWebApp() as any;
  if (!wa?.onEvent) return () => {};
  const events = ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged"];
  events.forEach((e) => wa.onEvent(e, cb));
  return () => events.forEach((e) => wa.offEvent?.(e, cb));
}
