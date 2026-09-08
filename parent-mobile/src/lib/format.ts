// Uzbek-facing formatters. The parent is always addressed as "Siz"; never
// surface a raw process/package name or an ISO string.

const WD_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const WD_LONG = [
  "Yakshanba",
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
];
const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

/** "2 soat 14 daqiqa", "46 daqiqa", "0 daqiqa". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h && rem) return `${h} soat ${rem} daqiqa`;
  if (h) return `${h} soat`;
  return `${rem} daqiqa`;
}

/** Compact form for chips and rows: "2s 14d", "46d". */
export function formatMinutesShort(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h && rem) return `${h}s ${rem}d`;
  if (h) return `${h}s`;
  return `${rem}d`;
}

export function minutesToHM(minutes: number): { h: number; m: number } {
  const total = Math.max(0, Math.round(minutes));
  return { h: Math.floor(total / 60), m: total % 60 };
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value.includes("T") ? value : `${value}T00:00:00`);
}

export function shortWeekday(value: string | Date): string {
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? "" : WD_SHORT[d.getDay()];
}

export function longWeekday(value: string | Date): string {
  const d = toDate(value);
  return Number.isNaN(d.getTime()) ? "" : WD_LONG[d.getDay()];
}

/** "8-sentabr" / "8-sentabr, 14:32" */
export function formatDate(value: string | Date, withTime = false): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  const base = `${d.getDate()}-${MONTHS[d.getMonth()]}`;
  if (!withTime) return base;
  return `${base}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTime(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Hozirgina", "5 daqiqa oldin", "3 soat oldin", "2 kun oldin". */
export function relativeTime(value: string | Date | null): string {
  if (!value) return "hali yo‘q";
  const d = toDate(value);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "hozirgina";
  if (min < 60) return `${min} daqiqa oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  return `${Math.floor(hr / 24)} kun oldin`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysISO(iso: string, delta: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isTodayISO(iso: string): boolean {
  return iso === todayISO();
}

/** "Bugun", "Kecha", or "8-sentabr". */
export function dayLabel(iso: string): string {
  if (iso === todayISO()) return "Bugun";
  if (iso === addDaysISO(todayISO(), -1)) return "Kecha";
  return formatDate(iso);
}

export function childAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = toDate(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const md = now.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
