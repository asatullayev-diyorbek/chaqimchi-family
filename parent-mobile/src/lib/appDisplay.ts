// Turns a raw Windows exe name (what the agent reports as app_id) into
// something a parent can read: a friendly label + a category. Ported from
// parent-web/src/lib/appDisplay.ts, minus the Iconify brand marks — on
// mobile the real per-app icon comes from the backend (data URI extracted
// from the exe); this only supplies the *name* and a category fallback.

import { colors } from "../theme";

export type AppCategory =
  | "brauzer"
  | "oyin"
  | "ijtimoiy"
  | "media"
  | "talim"
  | "dasturlash"
  | "tizim"
  | "boshqa";

type Entry = { name: string; category: AppCategory };

const REGISTRY: Record<string, Entry> = {
  "chrome.exe": { name: "Google Chrome", category: "brauzer" },
  "msedge.exe": { name: "Microsoft Edge", category: "brauzer" },
  "firefox.exe": { name: "Firefox", category: "brauzer" },
  "brave.exe": { name: "Brave", category: "brauzer" },
  "opera.exe": { name: "Opera", category: "brauzer" },
  "opera_gx.exe": { name: "Opera GX", category: "brauzer" },
  "iexplore.exe": { name: "Internet Explorer", category: "brauzer" },

  "robloxplayerbeta.exe": { name: "Roblox", category: "oyin" },
  "robloxplayerlauncher.exe": { name: "Roblox", category: "oyin" },
  "minecraft.exe": { name: "Minecraft", category: "oyin" },
  "minecraftlauncher.exe": { name: "Minecraft", category: "oyin" },
  "steam.exe": { name: "Steam", category: "oyin" },
  "steamwebhelper.exe": { name: "Steam", category: "oyin" },
  "epicgameslauncher.exe": { name: "Epic Games", category: "oyin" },
  "valorant.exe": { name: "Valorant", category: "oyin" },
  "valorant-win64-shipping.exe": { name: "Valorant", category: "oyin" },
  "leagueclient.exe": { name: "League of Legends", category: "oyin" },
  "fortniteclient-win64-shipping.exe": { name: "Fortnite", category: "oyin" },
  "cs2.exe": { name: "Counter-Strike 2", category: "oyin" },
  "gta5.exe": { name: "GTA V", category: "oyin" },
  "eurotrucks2.exe": { name: "Euro Truck Simulator 2", category: "oyin" },

  "telegram.exe": { name: "Telegram", category: "ijtimoiy" },
  "discord.exe": { name: "Discord", category: "ijtimoiy" },
  "whatsapp.exe": { name: "WhatsApp", category: "ijtimoiy" },
  "slack.exe": { name: "Slack", category: "ijtimoiy" },
  "skype.exe": { name: "Skype", category: "ijtimoiy" },
  "zoom.exe": { name: "Zoom", category: "ijtimoiy" },
  "messenger.exe": { name: "Messenger", category: "ijtimoiy" },

  "spotify.exe": { name: "Spotify", category: "media" },
  "vlc.exe": { name: "VLC", category: "media" },
  "wmplayer.exe": { name: "Windows Media Player", category: "media" },
  "music.ui.exe": { name: "Musiqa", category: "media" },
  "video.ui.exe": { name: "Video", category: "media" },

  "winword.exe": { name: "Word", category: "talim" },
  "excel.exe": { name: "Excel", category: "talim" },
  "powerpnt.exe": { name: "PowerPoint", category: "talim" },
  "outlook.exe": { name: "Outlook", category: "talim" },
  "onenote.exe": { name: "OneNote", category: "talim" },
  "acrobat.exe": { name: "Adobe Acrobat", category: "talim" },
  "acrord32.exe": { name: "Adobe Reader", category: "talim" },
  "notepad.exe": { name: "Bloknot", category: "talim" },
  "notepad++.exe": { name: "Notepad++", category: "talim" },
  "calc.exe": { name: "Kalkulyator", category: "talim" },

  "code.exe": { name: "VS Code", category: "dasturlash" },
  "devenv.exe": { name: "Visual Studio", category: "dasturlash" },
  "pycharm64.exe": { name: "PyCharm", category: "dasturlash" },
  "idea64.exe": { name: "IntelliJ IDEA", category: "dasturlash" },
  "sublime_text.exe": { name: "Sublime Text", category: "dasturlash" },
  "windowsterminal.exe": { name: "Windows Terminal", category: "dasturlash" },
  "powershell.exe": { name: "PowerShell", category: "dasturlash" },
  "cmd.exe": { name: "Buyruqlar qatori", category: "dasturlash" },

  "explorer.exe": { name: "Fayl menejeri", category: "tizim" },
  "applicationframehost.exe": { name: "Windows ilova", category: "tizim" },
  "systemsettings.exe": { name: "Sozlamalar", category: "tizim" },
  "taskmgr.exe": { name: "Vazifalar menejeri", category: "tizim" },
  "searchhost.exe": { name: "Qidiruv", category: "tizim" },
  "shellexperiencehost.exe": { name: "Windows qobig‘i", category: "tizim" },
  "lockapp.exe": { name: "Qulflangan ekran", category: "tizim" },
  "textinputhost.exe": { name: "Klaviatura", category: "tizim" },
};

export const CATEGORY_META: Record<
  AppCategory,
  { label: string; color: string; bg: string }
> = {
  brauzer: { label: "Brauzer", color: "#2563eb", bg: "#e6edfc" },
  oyin: { label: "O‘yinlar", color: "#d97706", bg: "#fef3c7" },
  ijtimoiy: { label: "Ijtimoiy", color: "#db2777", bg: "#fce7f3" },
  media: { label: "Media", color: "#7c3aed", bg: "#ede9fe" },
  talim: { label: "Ta’lim", color: "#059669", bg: "#d1fae5" },
  dasturlash: { label: "Dasturlash", color: "#0891b2", bg: "#cffafe" },
  tizim: { label: "Tizim", color: "#64748b", bg: "#e2e8f0" },
  boshqa: { label: "Boshqa", color: "#6b7280", bg: "#f3f4f6" },
};

function prettify(exe: string): string {
  let base = exe.replace(/\.(exe|app)$/i, "").replace(/[-_]+/g, " ");
  base = base
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return exe;
  return base
    .split(" ")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export type AppDisplay = {
  label: string;
  category: AppCategory;
  categoryLabel: string;
  color: string;
  bg: string;
  /** First letter, for the fallback tile when there's no real icon. */
  initial: string;
};

export function appDisplay(appId: string | null | undefined, agentName?: string | null): AppDisplay {
  const exe = (appId || "").trim();
  const hit = REGISTRY[exe.toLowerCase()];
  const category: AppCategory = hit?.category ?? "boshqa";
  const meta = CATEGORY_META[category];
  const agent = (agentName || "").trim();
  const agentUseful =
    agent && agent.toLowerCase() !== exe.toLowerCase() && !/\.exe$/i.test(agent);
  const label = hit?.name || (agentUseful ? agent : exe ? prettify(exe) : "Noma’lum ilova");
  return {
    label,
    category,
    categoryLabel: meta.label,
    color: meta.color,
    bg: meta.bg,
    initial: (label[0] || "?").toUpperCase(),
  };
}

export function domainDisplay(domain: string): { label: string; initial: string; color: string } {
  const clean = domain.replace(/^www\./, "");
  const initial = (clean[0] || "?").toUpperCase();
  // Deterministic hue from the domain string so the same site is the same colour.
  const hues = [colors.catBlue, colors.catTeal, colors.catAmber, colors.catPurple, colors.mint];
  let h = 0;
  for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) >>> 0;
  return { label: clean, initial, color: hues[h % hues.length] };
}
