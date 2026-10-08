/**
 * The admin reminder kinds, shared by the panel (client) and lib/emails.ts
 * (server). Kept apart from emails.ts because that file reads the database
 * and can't be bundled for the browser.
 */

export const NOTIFY_TYPES = ["unclaimed", "countdown", "packing", "shopping"] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];

/** Button text and who receives it, always the people on the trip. */
export const NOTIFY_INFO: Record<NotifyType, { label: string; who: string }> = {
  unclaimed: { label: "ציוד שחסר", who: "לכל המשתתפים" },
  countdown: { label: "ספירה לאחור", who: "לכל המשתתפים" },
  packing: { label: "תזכורת אריזה", who: "אישית לכל אחד" },
  shopping: { label: "קניות שנשארו", who: "לאחראי הקניות" },
};
