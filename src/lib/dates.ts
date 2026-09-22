const TZ = "Asia/Jerusalem";

/**
 * Today's date in Israel as a plain "YYYY-MM-DD" string.
 *
 * Everything date-shaped in this app is a date-only string, never a Date
 * object. A Date would be interpreted in the server's timezone (UTC on Vercel),
 * so a trip starting 1.10 would render as 30.9 for anyone in Israel after
 * midnight. Comparing strings sidesteps the whole class of bug.
 * "en-CA" is used purely because it formats as YYYY-MM-DD.
 */
export function todayInIsrael(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Whole days from today (Israel) until `date`. Negative once it has passed. */
export function daysUntil(date: string, from: string = todayInIsrael()): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

const HEBREW_WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** "חמישי 1.10" */
export function formatTripDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = HEBREW_WEEKDAYS[d.getUTCDay()];
  return `${weekday} ${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}

/** "1.10.2026" */
export function formatShortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

export const SLOT_LABELS: Record<string, string> = {
  breakfast: "בוקר",
  lunch: "צהריים",
  dinner: "ערב",
};
