// Spino24 mobile design tokens.
//
// The palette is inherited from parent-web (src/app/globals.css) and the
// marketing site so all Spino24 surfaces read as one product. Mobile is
// light-only for now (dark structure is kept below so a later theme switch
// is a token swap, not a refactor).
//
// Spino24 brand accents — "Spino" green/lime, "24" orange/yellow — are used
// sparingly: app icon, splash, auth header, empty-state art. The everyday UI
// stays on the calm blue / mint / slate glass environment.

export type ThemeMode = "light" | "dark";

const lightColors = {
  // Base
  background: "#eef1fb",
  surface: "#ffffff",
  surfaceMuted: "#f7f9fd",
  surfaceSunken: "#eef2f8",
  text: "#1f2b3a",
  body: "#4c5d78",
  muted: "#7a8698",
  faint: "#9aa6b6",
  border: "#e7ebf2",
  borderStrong: "#d8dEe9",
  /** Hairline on a shadowed card — near-invisible on the light gradient. */
  cardBorder: "rgba(255,255,255,0.9)",
  overlay: "rgba(20,28,44,0.42)",

  // Accents
  blue: "#2563eb",
  blueDark: "#1d4ed8",
  blueSoft: "#e8f0ff",
  mint: "#2fbfa6",
  mintDark: "#22a68c",
  mintSoft: "#d8f5ee",
  warning: "#f28a3a",
  warningSoft: "#fdecdd",
  danger: "#f5455a",
  dangerSoft: "#fde3e6",
  success: "#22a68c",

  // Spino24 brand
  brandGreen: "#5bbf3a",
  brandGreenSoft: "#e7f6df",
  brandOrange: "#f5a524",
  brandOrangeSoft: "#fdefd6",

  // Categorical (fixed order — never re-cycled per app)
  catTeal: "#2fc8ad",
  catTealBg: "#d8f5ee",
  catBlue: "#6f97f0",
  catBlueBg: "#e2ecfd",
  catAmber: "#f5c04e",
  catAmberBg: "#fdeede",
  catPurple: "#a78bfa",
  catPurpleBg: "#efe9fb",
  catSlate: "#c7cfd8",
  catSlateBg: "#eaeef0",

  // Charts
  chartGrid: "rgba(37,99,235,0.10)",
  chartTrack: "rgba(37,99,235,0.06)",
  chartAxis: "#9aa6b6",
  chartBar: "#a9c9fb",
  chartBarActive: "#2563eb",

  // Day-timeline buckets (small fixed set)
  bucketApp: "#2563eb",
  bucketWork: "#8b5cf6",
  bucketSystem: "#f97316",
  bucketBlocked: "#94a3b8",
};

const darkColors: typeof lightColors = {
  ...lightColors,
  background: "#101725",
  surface: "#1a2436",
  surfaceMuted: "#161f2f",
  surfaceSunken: "#131b28",
  blue: "#4b8bf5",
  blueDark: "#3b82f6",
  text: "#e8edf5",
  body: "#b9c4d2",
  muted: "#94a3b8",
  faint: "#7b8798",
  border: "#2b3648",
  borderStrong: "#38455a",
  cardBorder: "rgba(255,255,255,0.06)",
  overlay: "rgba(0,0,0,0.6)",
  blueSoft: "rgba(37,99,235,0.18)",
  mintSoft: "rgba(47,191,166,0.16)",
  warningSoft: "rgba(242,138,58,0.16)",
  dangerSoft: "rgba(245,69,90,0.16)",
  brandGreenSoft: "rgba(91,191,58,0.16)",
  brandOrangeSoft: "rgba(245,165,36,0.16)",
  chartGrid: "rgba(148,163,184,0.18)",
  chartTrack: "rgba(148,163,184,0.10)",
  chartBar: "#3b5a86",
  chartBarActive: "#60a5fa",
};

export const palettes = { light: lightColors, dark: darkColors };
export type Palette = typeof lightColors;

// The active palette is swapped at runtime by <ThemeProvider>. Components
// keep importing `colors` as before; the Proxy resolves each token against
// whichever palette is live, so a mode change + re-render is all it takes.
let _mode: ThemeMode = "light";
let _active: Palette = palettes.light;

export function setThemeMode(mode: ThemeMode): void {
  _mode = mode;
  _active = palettes[mode];
}
export function getThemeMode(): ThemeMode {
  return _mode;
}

export const colors: Palette = new Proxy({} as Palette, {
  get: (_t, key) => (_active as Record<string, unknown>)[key as string],
  set: () => true,
}) as Palette;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: "800" as const },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "800" as const },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "800" as const },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: "800" as const },
  bodyLg: { fontSize: 16, lineHeight: 23, fontWeight: "400" as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const },
  label: { fontSize: 14, lineHeight: 19, fontWeight: "700" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "700" as const },
};

export const shadow = {
  // Soft, low, close — cards should feel like they're barely lifted off the
  // page, not floating. A single tight shadow reads cleaner than a big blur.
  card: {
    shadowColor: "#7089b0",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#5b7099",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  sheet: {
    shadowColor: "#1e293b",
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  none: {},
};

// Gradients (as [from, to] pairs) for react-native-svg <LinearGradient>.
export const gradients = {
  brand: ["#2563eb", "#4f7bf7"],
  mint: ["#2fbfa6", "#4dd6bd"],
  bar: ["#c9dcfb", "#8fb6f8"],
  barActive: ["#3b82f6", "#2563eb"],
  ring: ["#3b82f6", "#22a6ff"],
  ringWarn: ["#f5a524", "#f2843a"],
  ringDanger: ["#f5455a", "#f2843a"],
};

// A stable colour per child so the same person reads the same everywhere.
export const FAMILY_COLORS = ["#2563eb", "#7c3aed", "#0d9488", "#d97706", "#db2777", "#4f46e5"];

export const CAT_COLORS = [
  colors.catTeal,
  colors.catBlue,
  colors.catAmber,
  colors.catPurple,
  colors.catSlate,
];
