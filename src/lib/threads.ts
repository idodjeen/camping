/**
 * A thread is the place a tap opens. Bell rows with the same thread key (within
 * one trip) are shown as one line and pushed as one notification.
 *
 * Pure on purpose, no database: the server writes the keys and builds push
 * tags, and the client reads them to open the right screen and to close the
 * right delivered notification, so both must agree on every string here.
 *
 *   gear:12 shopping:3 meal:5   an item's thread sheet
 *   chat                        the general room
 *   list:gear list:shopping     a list screen
 *   money                       the expenses screen
 *   reminder:<type>             what an admin reminder is about
 */
import { NOTIFY_INFO, isNotifyType } from "@/lib/reminders";

export const SUBJECTS = ["gear", "shopping", "meal"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const THREAD = {
  item: (subject: Subject, id: number) => `${subject}:${id}`,
  chat: "chat",
  list: (list: "gear" | "shopping") => `list:${list}`,
  money: "money",
  reminder: (type: string) => `reminder:${type}`,
} as const;

/** Where a tap on a thread goes: a screen inside the trip, and maybe a sheet on it. */
export type Target = { page: string; sheet?: { subject: Subject; id: number } };

const ITEM_PAGE: Record<Subject, string> = { gear: "/gear", shopping: "/shopping", meal: "/meals" };

export function targetOf(key: string): Target {
  if (key === THREAD.chat) return { page: "/room" };
  if (key === THREAD.money) return { page: "/expenses" };

  const at = key.indexOf(":");
  const head = at < 0 ? key : key.slice(0, at);
  const rest = at < 0 ? "" : key.slice(at + 1);

  if (head === "list") return { page: rest === "shopping" ? "/shopping" : "/gear" };
  if (head === "reminder" && isNotifyType(rest)) return { page: NOTIFY_INFO[rest].page };

  const subject = SUBJECTS.find((s) => s === head);
  const id = Number(rest);
  if (subject && Number.isInteger(id) && id > 0) {
    return { page: ITEM_PAGE[subject], sheet: { subject, id } };
  }
  // Anything a later release adds: the trip's home.
  return { page: "/" };
}

/** What a thread is called when it is not an item with a name of its own. */
export function staticLabel(key: string): string | null {
  if (key === THREAD.chat) return "צ׳אט כללי";
  if (key === THREAD.money) return "כסף";
  if (key === THREAD.list("gear")) return "ציוד";
  if (key === THREAD.list("shopping")) return "קניות";
  if (key.startsWith("reminder:")) return "תזכורת";
  return null;
}

/**
 * The tag a push for this thread carries. The service worker replaces any
 * delivered notification with the same tag, and the app closes it by tag once
 * the thread is read. Prefixed with the trip because thread keys repeat
 * across trips (gear:12 exists in each).
 */
export const pushTag = (tripId: number, key: string) => `t${tripId}:${key}`;

/** The tags that belong to one trip, for "mark all read". */
export const pushTagPrefix = (tripId: number) => `t${tripId}:`;
