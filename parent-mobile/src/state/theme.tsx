import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, Platform } from "react-native";
import { palettes, setThemeMode, ThemeMode } from "../theme";
import { getWebApp } from "../lib/telegram";
import { storageGet, storageGetSync, storageSet } from "../platform/storage";

const KEY = "spino24_theme"; // "system" | "light" | "dark"

export type ThemePref = "system" | ThemeMode;

/** Resolve the user preference to a concrete palette. "system" follows the
 *  Telegram colour scheme inside a Mini App, otherwise the OS. */
function resolve(pref: ThemePref): ThemeMode {
  if (pref !== "system") return pref;
  const tg = getWebApp()?.colorScheme;
  if (tg === "light" || tg === "dark") return tg;
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

// Apply synchronously at module load so the very first paint is themed right
// (web reads localStorage; native starts on system and corrects async).
const initialPref = (storageGetSync(KEY) as ThemePref) || "system";
setThemeMode(resolve(initialPref));

type Ctx = {
  pref: ThemePref;
  mode: ThemeMode;
  setPref: (p: ThemePref) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(initialPref);
  const [mode, setMode] = useState<ThemeMode>(resolve(initialPref));

  // Load the stored preference on native (web already had it synchronously).
  useEffect(() => {
    if (Platform.OS === "web") return;
    storageGet(KEY).then((stored) => {
      if (stored && stored !== pref) apply(stored as ThemePref, false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the system / Telegram scheme while on "system".
  useEffect(() => {
    if (pref !== "system") return;
    const sub = Appearance.addChangeListener(() => setMode(resolve("system")));
    const wa = getWebApp() as any;
    wa?.onEvent?.("themeChanged", () => setMode(resolve("system")));
    return () => sub.remove();
  }, [pref]);

  // Push the resolved mode into the theme module + the surrounding chrome.
  useEffect(() => {
    setThemeMode(mode);
    const bg = palettes[mode].background;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.backgroundColor = bg;
      document.documentElement.style.backgroundColor = bg;
    }
    const wa = getWebApp();
    try {
      wa?.setBackgroundColor?.(bg);
      wa?.setHeaderColor?.(bg);
    } catch {
      /* older client */
    }
  }, [mode]);

  const apply = useCallback((p: ThemePref, persist = true) => {
    setPrefState(p);
    setMode(resolve(p));
    if (persist) storageSet(KEY, p);
  }, []);

  const value = useMemo<Ctx>(() => ({ pref, mode, setPref: apply }), [pref, mode, apply]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
