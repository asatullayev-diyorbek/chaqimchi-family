export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "chaqimchi_theme";

/**
 * Runs before hydration, inlined into <head> by the root layout. Setting
 * data-theme this early is what prevents a light flash before React mounts —
 * by the time the first paint happens the token set is already correct.
 *
 * Kept as a string (not an imported function) because it has to execute as a
 * classic blocking script, before any bundle loads.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

/** The theme currently painted on <html>. */
export function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * Applies a theme and remembers it. Storage can throw (Safari private mode,
 * blocked site data) — the theme still applies, it just won't persist.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — session-only theme is an acceptable fallback */
  }
}
