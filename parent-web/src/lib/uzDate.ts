/**
 * Uzbek date formatting that does not depend on the browser shipping
 * uz-UZ locale data.
 *
 * `Intl` does not throw on a missing locale — it silently falls back to the
 * ICU root locale, which is where the "M08 29, Sat" a parent reported comes
 * from. Uzbek is far enough down the long tail that we cannot assume every
 * browser and OS carries it, and a silent fallback is worse than none: the
 * app looks broken in a language the user never chose.
 *
 * These names are short and stable, so we keep them rather than gamble.
 * Everything here reads local-time getters, matching the `new Date(iso +
 * "T00:00:00")` construction the pages use.
 */

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

/** Indexed by getDay(): 0 is Sunday. */
const WEEKDAYS = [
  "yakshanba", "dushanba", "seshanba", "chorshanba",
  "payshanba", "juma", "shanba",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** "29-avgust" */
export function uzDayMonth(date: Date): string {
  return `${date.getDate()}-${MONTHS[date.getMonth()]}`;
}

/** "shanba, 29-avgust" */
export function uzWeekdayDayMonth(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${uzDayMonth(date)}`;
}

/** "19:30" — 24-hour, which is what Uzbek uses. */
export function uzTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "29-avgust 2026, 19:30" */
export function uzDateTime(date: Date): string {
  return `${uzDayMonth(date)} ${date.getFullYear()}, ${uzTime(date)}`;
}
