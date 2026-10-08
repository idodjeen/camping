/**
 * The admin reminder kinds, shared by the panel (client) and lib/emails.ts
 * (server). Kept apart from emails.ts because that file reads the database
 * and can't be bundled for the browser.
 */

export const NOTIFY_TYPES = ["unclaimed", "countdown", "packing", "shopping"] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];

/**
 * Button text, who receives it (always people on the trip), and the screen
 * its push and bell row open, inside the trip.
 */
export const NOTIFY_INFO: Record<NotifyType, { label: string; who: string; page: string }> = {
  unclaimed: { label: "ציוד שחסר", who: "לכל המשתתפים", page: "/gear?filter=todo" },
  countdown: { label: "ספירה לאחור", who: "לכל המשתתפים", page: "/" },
  packing: { label: "תזכורת אריזה", who: "אישית לכל אחד", page: "/gear?filter=mine" },
  shopping: { label: "קניות שנשארו", who: "לאחראי הקניות", page: "/shopping?filter=todo" },
};

export const isNotifyType = (s: string): s is NotifyType => (NOTIFY_TYPES as readonly string[]).includes(s);
