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

/** "YYYY-MM-DDTHH:mm" in Israel — sortable, and comparable as a plain string. */
export function nowInIsrael(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Meals have a slot, not a time. These anchors turn "שישי צהריים" into
 * something comparable with the clock so the dashboard can pick the next one.
 */
export const SLOT_HOUR: Record<string, string> = {
  breakfast: "08:00",
  lunch: "13:00",
  dinner: "19:00",
};

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

/**
 * "עכשיו" / "לפני 4 דק׳" / "אתמול" — for comment and mention timestamps.
 *
 * Unlike everything above, this one takes a real ISO instant rather than a
 * date-only string: a comment happened at a moment in time, not on a day.
 */
export function formatRelative(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `לפני ${hrs} שע׳`;
  const days = Math.round(hrs / 24);
  // Hebrew has a dual form, so "לפני 2 ימים" and "לפני 1 ימים" are both wrong.
  if (days === 1) return "אתמול";
  if (days === 2) return "לפני יומיים";
  return `לפני ${days} ימים`;
}
