/**
 * A trip's meeting point, as the admin pastes it: plain coordinates or a
 * Google Maps link. Pure, so the form reads it back as you type and the API
 * applies the very same rules.
 */

export type Coords = { lat: number; lng: number };

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

/**
 * Where in a link the coordinates can sit, best first. `!3d…!4d…` is the
 * place itself; `@lat,lng` is only where the map was centred, so it comes
 * after the explicit query parameters.
 */
const PATTERNS = [
  new RegExp(`!3d${NUM}!4d${NUM}`),
  new RegExp(`[?&](?:q|query|ll|destination)=${NUM}(?:,|%2C)(?:\\s|\\+|%20)*${NUM}`, "i"),
  new RegExp(`@${NUM},${NUM}`),
];

const PLAIN = new RegExp(String.raw`^\(?\s*${NUM}\s*[,\s]\s*${NUM}\s*\)?$`);

/** Short links redirect to the real one; reading them would mean fetching. */
const SHORT = /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i;

/** The coordinates in `text`, or why there are none. */
export function parseCoords(text: string): Coords | { error: string } {
  const s = text.trim();
  if (!s) return { error: "חסר מיקום" };
  if (SHORT.test(s)) {
    return { error: "קישור מקוצר אי אפשר לקרוא. פתחו אותו בדפדפן והדביקו את הקישור המלא, או את הקואורדינטות" };
  }

  const match = s.match(PLAIN) ?? PATTERNS.map((p) => s.match(p)).find(Boolean);
  if (!match) return { error: 'לא נמצאו קואורדינטות. למשל: 32.79, 35.53' };

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return { error: "הקואורדינטות מחוץ לטווח" };
  return { lat, lng };
}
