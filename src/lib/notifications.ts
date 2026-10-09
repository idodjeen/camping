import { and, desc, eq, inArray, isNotNull, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { after } from "next/server";

import { db } from "@/db";
import {
  NOTIFICATION_KINDS,
  comments,
  gearItems,
  groupMembers,
  meals,
  notifications,
  shoppingItems,
  trip,
  tripMembers,
  users,
  type NotificationKind,
  type NotifySwitches,
  type User,
} from "@/db/schema";
import { eventText } from "@/lib/notification-text";
import { sendPushEach } from "@/lib/push";
import { HttpError } from "@/lib/session";
import { pushTag, staticLabel, targetOf, type Subject, type Target } from "@/lib/threads";

/* ---------------------------------------------------------- who hears what */

/** The switches in חשבון, stored in `users.notify_prefs`. */
type Switch = keyof NotifySwitches;
const SWITCHES: Switch[] = ["mentions", "chat", "lists", "money"];

const SWITCH_OF: Record<NotificationKind, Switch | null> = {
  mention: "mentions",
  message: "chat",
  covered: "lists",
  uncovered: "lists",
  gear_added: "lists",
  shopping_added: "lists",
  bought: "lists",
  expense_added: "money",
  expense_edited: "money",
  expense_deleted: "money",
  settlement: "money",
  // Sent by hand and rarely; the email has no opt-out either.
  reminder: null,
};

/** A switch is on unless it says false: a missing key reads as on. */
const isOn = (u: User, s: Switch) => u.notifyPrefs?.[s] !== false;

/** The same rule as SQL, for rows joined to their recipient's `users` row. */
const switchSql = (s: Switch) => sql`coalesce((${users.notifyPrefs} ->> ${s})::boolean, true)`;

/** Does this person want to hear about this kind? */
export const hears = (u: User, kind: NotificationKind) => {
  const s = SWITCH_OF[kind];
  return s === null || isOn(u, s);
};

/**
 * hears(), as a predicate over `notifications` joined to `users` on the
 * recipient. The one rule behind the bell, every count and every push: a row
 * whose switch is off is hidden, not deleted, so switching it back on brings
 * the history back rather than a gap.
 */
function visibleTo(): SQL {
  const whens = SWITCHES.map((s) => {
    const kinds = NOTIFICATION_KINDS.filter((k) => SWITCH_OF[k] === s);
    return sql`when ${notifications.kind} in (${sql.join(
      kinds.map((k) => sql`${k}`),
      sql`, `,
    )}) then ${switchSql(s)}`;
  });
  return sql`(case ${sql.join(whens, sql` `)} else true end)`;
}

/** Rows for a trip the person is still on; another trip's stale rows don't count. */
const stillOnTrip = () =>
  sql`exists (select 1 from ${tripMembers} where ${tripMembers.tripId} = ${notifications.tripId} and ${tripMembers.userId} = ${notifications.userId})`;

/** A row's thread, with a stand-in for rows the previous deploy wrote without one. */
const threadOf = (n: { id: number; threadKey: string | null }) => n.threadKey ?? `row:${n.id}`;
const threadSql = sql`coalesce(${notifications.threadKey}, 'row:' || ${notifications.id})`;

/**
 * Who can hear about something on a trip: the people on it, never the actor,
 * and never a viewer (they couldn't mark anything read: every write is 403
 * for them). `to` narrows it further, such as to the people tagged.
 */
async function audienceOf(tripId: number, actorId: number, to?: number[]): Promise<User[]> {
  if (to && to.length === 0) return [];
  const rows = await db
    .select({ user: users })
    .from(tripMembers)
    .innerJoin(users, eq(users.id, tripMembers.userId))
    .innerJoin(trip, eq(trip.id, tripMembers.tripId))
    .leftJoin(
      groupMembers,
      and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, users.id)),
    )
    .where(
      and(
        eq(tripMembers.tripId, tripId),
        ne(users.id, actorId),
        to ? inArray(users.id, to) : undefined,
        or(isNull(groupMembers.role), ne(groupMembers.role, "viewer")),
      ),
    );
  return rows.map((r) => r.user);
}

/* ------------------------------------------------------------------ notify */

export type NotifyInput = {
  tripId: number;
  kind: NotificationKind;
  actorId: number;
  /** The thread key, from THREAD in lib/threads.ts. */
  thread: string;
  /** Only these people (still filtered as in audienceOf). Omit for everyone on the trip. */
  to?: number[];
  /** What the row is about. Each one cascades, so deleting it takes the row along. */
  refs?: {
    commentId?: number;
    gearItemId?: number;
    shoppingItemId?: number;
    expenseId?: number;
    settlementId?: number;
  };
  /** Snapshots that must outlive the subject; for the newer kinds, what eventText() words. */
  data?: Record<string, unknown>;
  /**
   * For the push: what the thread is called, and this event's own text.
   * Without a preview, each person's text comes from eventText(), so a money
   * push can say "החלק שלך".
   */
  push: { label: string; preview?: string };
};

/**
 * The one way anything reaches the bell and the phone.
 *
 * Call it after your own write has committed, never inside a transaction that
 * holds a row lock. It never throws: losing a notification must not lose the
 * message, the claim or the expense that caused it. The rows are written
 * before it returns; the pushes go out in after(), so the person acting
 * doesn't wait on everyone's push services.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const { tripId, kind, actorId, thread, refs = {} } = input;
    const audience = await audienceOf(tripId, actorId, input.to);
    // Tags are always written: they also drive the "tagged you" markers on
    // list rows and in the chat. The bell hides them when tags are off.
    const rows = kind === "mention" ? audience : audience.filter((u) => hears(u, kind));
    if (rows.length === 0) return;

    await db
      .insert(notifications)
      .values(
        rows.map((u) => ({
          tripId,
          userId: u.id,
          kind,
          actorId,
          threadKey: thread,
          commentId: refs.commentId ?? null,
          gearItemId: refs.gearItemId ?? null,
          shoppingItemId: refs.shoppingItemId ?? null,
          expenseId: refs.expenseId ?? null,
          settlementId: refs.settlementId ?? null,
          data: input.data ?? null,
        })),
      )
      // A tag is unique per comment and person; anything else never conflicts.
      .onConflictDoNothing();

    const hearing = rows.filter((u) => hears(u, kind)).map((u) => u.id);
    if (hearing.length > 0) {
      await defer(() => pushThread(input, hearing));
    }
  } catch (err) {
    console.error("notify failed", input.kind, err);
  }
}

/**
 * after() when there is a request to run after; inline otherwise (a script,
 * or a test calling changeClaim directly), where after() throws.
 */
async function defer(task: () => Promise<void>) {
  const run = () => task().catch((err) => console.error("deferred push failed", err));
  try {
    after(run);
  } catch {
    await run();
  }
}

/**
 * One push per recipient for the whole thread: "3 חדשות · אחרונה מניר: …",
 * tagged by thread so it replaces the one already on the phone, with the
 * unread thread count for the app icon. The counts are read after the insert,
 * so they include this event.
 */
async function pushThread(input: NotifyInput, userIds: number[]) {
  const { tripId, kind, actorId, thread, push } = input;
  const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, actorId));
  const counts = await db
    .select({
      userId: notifications.userId,
      inThread: sql<number>`(count(*) filter (where ${notifications.tripId} = ${tripId} and ${notifications.threadKey} = ${thread}))::int`,
      threads: sql<number>`count(distinct (${notifications.tripId}, ${threadSql}))::int`,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(
      and(
        inArray(notifications.userId, userIds),
        isNull(notifications.readAt),
        visibleTo(),
        stillOnTrip(),
      ),
    )
    .groupBy(notifications.userId);
  const byUser = new Map(counts.map((c) => [c.userId, c]));

  const name = actor?.name ?? "מישהו";
  const url = `/t/${tripId}${targetOf(thread).page}`;
  const previewFor = (userId: number) =>
    push.preview ?? eventText(kind, input.data, { id: actorId, name }, userId);
  await sendPushEach(
    userIds.map((userId) => {
      const c = byUser.get(userId);
      const n = Math.max(c?.inThread ?? 1, 1);
      return {
        userId,
        payload: {
          ...pushText(kind, n, name, { label: push.label, preview: previewFor(userId) }),
          url,
          tag: pushTag(tripId, thread),
          badge: Math.max(c?.threads ?? 1, 1),
        },
      };
    }),
  );
}

function pushText(
  kind: NotificationKind,
  n: number,
  actor: string,
  { label, preview }: { label: string; preview: string },
) {
  if (n > 1) return { title: label, body: `${n} חדשות · אחרונה מ${actor}: ${preview}` };
  switch (kind) {
    case "mention":
      return { title: `${actor} תייג אותך`, body: preview };
    case "message":
      return { title: actor, body: preview };
    case "covered":
      return { title: "פריט כוסה 🎉", body: `${actor} לקח את האחרון: ${label}` };
    default:
      return { title: label, body: preview };
  }
}

/* ------------------------------------------------------------------- inbox */

export type Person = { id: number; name: string; slug: string; avatarUrl: string | null };

/** One bell row. */
export type InboxRow = {
  id: number;
  kind: NotificationKind;
  thread: string;
  /** What the thread is called: the item's name, "צ׳אט כללי", "כסף". */
  label: string;
  target: Target;
  /** The message text for tags and messages, the worded event for the newer kinds; empty for "covered". */
  text: string;
  /** For tags and messages: when the author last edited the text (the preview is always the current text). */
  editedAt: string | null;
  createdAt: string;
  readAt: string | null;
  actor: Person;
};

/** The unread rows of one thread, as one line in the bell. */
export type InboxGroup = {
  thread: string;
  label: string;
  target: Target;
  count: number;
  /** How many of those rows tag me; any at all shows the "תייגו אותך" chip. */
  tags: number;
  /** Everyone who wrote, newest first. */
  actors: Person[];
  /** Every kind in the group, so "ניר קנה 12 פריטים" knows it's all purchases. */
  kinds: NotificationKind[];
  latest: InboxRow;
  /** The newest row's id, so a read can stop at what was on screen. */
  newestId: number;
};

export type InboxCounts = {
  /** Unread threads on this trip: the bell and, with otherTrips, the app icon. */
  threads: number;
  /** Unread tags per list, for the nav and the menu. */
  tags: { gear: number; shopping: number; meals: number; chat: number };
  /** Unread threads on my other trips: a dot on the trip switcher. */
  otherTrips: number;
};

export type Inbox = { unread: InboxGroup[]; recent: InboxRow[]; counts: InboxCounts };

/** At most this many unread rows are grouped; the counts come from SQL and stay exact. */
const GROUP_LIMIT = 300;
const RECENT_LIMIT = 40;

const actor = alias(users, "actor");

/** Rows of mine on one trip, newest first, with what the bell shows for them. */
async function loadRows(userId: number, tripId: number, where: SQL | undefined, limit: number) {
  const rows = await db
    .select({
      n: notifications,
      actor: { id: actor.id, name: actor.name, slug: actor.slug, avatarUrl: actor.avatarUrl },
      body: comments.body,
      editedAt: comments.editedAt,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .innerJoin(actor, eq(actor.id, notifications.actorId))
    .leftJoin(
      comments,
      and(eq(comments.tripId, notifications.tripId), eq(comments.id, notifications.commentId)),
    )
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.tripId, tripId),
        visibleTo(),
        where,
      ),
    )
    .orderBy(desc(notifications.id))
    .limit(limit);

  const labels = await labelsFor(tripId, rows.map((r) => threadOf(r.n)));
  return rows.map(
    ({ n, actor, body, editedAt }): InboxRow => {
      const thread = threadOf(n);
      return {
        id: n.id,
        kind: n.kind,
        thread,
        label: labels.get(thread) ?? "פריט שנמחק",
        target: targetOf(thread),
        text: body ?? eventText(n.kind, n.data, actor, userId),
        editedAt: editedAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
        actor,
      };
    },
  );
}

/** Item names for the threads that are items; three small queries at most. */
async function labelsFor(tripId: number, keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids: Record<Subject, number[]> = { gear: [], shopping: [], meal: [] };
  for (const key of new Set(keys)) {
    const fixed = staticLabel(key);
    if (fixed) out.set(key, fixed);
    else {
      const sheet = targetOf(key).sheet;
      if (sheet) ids[sheet.subject].push(sheet.id);
      else out.set(key, "התראה");
    }
  }

  const [gear, shopping, meal] = await Promise.all([
    ids.gear.length === 0
      ? []
      : db
          .select({ id: gearItems.id, name: gearItems.name })
          .from(gearItems)
          .where(and(eq(gearItems.tripId, tripId), inArray(gearItems.id, ids.gear))),
    ids.shopping.length === 0
      ? []
      : db
          .select({ id: shoppingItems.id, name: shoppingItems.name })
          .from(shoppingItems)
          .where(and(eq(shoppingItems.tripId, tripId), inArray(shoppingItems.id, ids.shopping))),
    ids.meal.length === 0
      ? []
      : db
          .select({ id: meals.id, name: meals.title })
          .from(meals)
          .where(and(eq(meals.tripId, tripId), inArray(meals.id, ids.meal))),
  ]);
  for (const r of gear) out.set(`gear:${r.id}`, r.name);
  for (const r of shopping) out.set(`shopping:${r.id}`, r.name);
  for (const r of meal) out.set(`meal:${r.id}`, r.name);
  return out;
}

/** Newest first in, one group per thread out, ordered by each thread's newest row. */
function groupRows(rows: InboxRow[]): InboxGroup[] {
  const groups = new Map<string, InboxGroup>();
  for (const r of rows) {
    const g = groups.get(r.thread);
    if (!g) {
      groups.set(r.thread, {
        thread: r.thread,
        label: r.label,
        target: r.target,
        count: 1,
        tags: r.kind === "mention" ? 1 : 0,
        actors: [r.actor],
        kinds: [r.kind],
        latest: r,
        newestId: r.id,
      });
      continue;
    }
    g.count += 1;
    if (r.kind === "mention") g.tags += 1;
    if (!g.actors.some((a) => a.id === r.actor.id)) g.actors.push(r.actor);
    if (!g.kinds.includes(r.kind)) g.kinds.push(r.kind);
  }
  return [...groups.values()];
}

const mine = (userId: number) =>
  and(eq(notifications.userId, userId), isNull(notifications.readAt), visibleTo());

const tagsIn = (prefix: string) =>
  sql<number>`(count(*) filter (where ${notifications.kind} = 'mention' and ${notifications.threadKey} like ${prefix}))::int`;

/** Unread threads and tags on this trip. Exact, whatever GROUP_LIMIT cuts. */
async function tripCounts(userId: number, tripId: number) {
  const [row] = await db
    .select({
      threads: sql<number>`count(distinct ${threadSql})::int`,
      gear: tagsIn("gear:%"),
      shopping: tagsIn("shopping:%"),
      meals: tagsIn("meal:%"),
      chat: sql<number>`(count(*) filter (where ${notifications.kind} = 'mention' and ${notifications.threadKey} = 'chat'))::int`,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(and(mine(userId), eq(notifications.tripId, tripId)));
  return {
    threads: row?.threads ?? 0,
    tags: {
      gear: row?.gear ?? 0,
      shopping: row?.shopping ?? 0,
      meals: row?.meals ?? 0,
      chat: row?.chat ?? 0,
    },
  };
}

async function otherTripsCount(userId: number, tripId: number) {
  const [row] = await db
    .select({ threads: sql<number>`count(distinct (${notifications.tripId}, ${threadSql}))::int` })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(and(mine(userId), ne(notifications.tripId, tripId), stillOnTrip()));
  return row?.threads ?? 0;
}

/**
 * My bell on one trip. `canWrite` false (a viewer, or a member who isn't on
 * this trip) gets an empty inbox: nothing here is theirs to read. They still
 * hear about their other trips.
 */
export async function getInbox(userId: number, tripId: number, canWrite: boolean): Promise<Inbox> {
  if (!canWrite) {
    return {
      unread: [],
      recent: [],
      counts: {
        threads: 0,
        tags: { gear: 0, shopping: 0, meals: 0, chat: 0 },
        otherTrips: await otherTripsCount(userId, tripId),
      },
    };
  }

  const [unread, recent, counts, otherTrips] = await Promise.all([
    loadRows(userId, tripId, isNull(notifications.readAt), GROUP_LIMIT),
    loadRows(userId, tripId, isNotNull(notifications.readAt), RECENT_LIMIT),
    tripCounts(userId, tripId),
    otherTripsCount(userId, tripId),
  ]);
  return { unread: groupRows(unread), recent, counts: { ...counts, otherTrips } };
}

/* -------------------------------------------------------------- mark read */

export type ReadRequest = { thread?: unknown; all?: unknown; upTo?: unknown };

/**
 * Marks one thread of mine, or all of them, read on one trip. `upTo` is the
 * newest row the client had on screen, so a message that lands after you
 * opened the bell stays unread. Only ever my own rows: the session's user id
 * is in the WHERE, so there is nobody else's row to reach.
 */
export async function markRead(userId: number, tripId: number, body: ReadRequest) {
  const all = body.all === true;
  const thread = typeof body.thread === "string" && body.thread.length <= 100 ? body.thread : null;
  if (!all && !thread) throw new HttpError(400, "חסר שרשור");
  if (body.upTo !== undefined && !Number.isInteger(body.upTo)) {
    throw new HttpError(400, "מזהה לא תקין");
  }
  const upTo = body.upTo as number | undefined;

  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.tripId, tripId),
        isNull(notifications.readAt),
        all ? undefined : eq(notifications.threadKey, thread!),
        upTo === undefined ? undefined : lte(notifications.id, upTo),
      ),
    )
    .returning({ id: notifications.id });
  return { marked: updated.length };
}

/* ------------------------------------------- adapters for one release (H) */

/** The old bell feed's shapes, for a bundle that was open during the deploy. */
type LegacyTopic = Subject | "general";
type LegacyRow = {
  id: number;
  subject: LegacyTopic;
  subjectId: number;
  subjectLabel: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  author: Person;
};

const legacyRow = (r: InboxRow): LegacyRow => ({
  id: r.id,
  subject: r.target.sheet?.subject ?? "general",
  subjectId: r.target.sheet?.id ?? 0,
  subjectLabel: r.label,
  body: r.text,
  createdAt: r.createdAt,
  readAt: r.readAt,
  author: r.actor,
});

/** ADAPTER, removed in H: GET /api/t/[tripId]/notifications in its old shape. */
export async function legacyFeed(userId: number, tripId: number) {
  const [mentions, others] = await Promise.all([
    loadRows(userId, tripId, eq(notifications.kind, "mention"), RECENT_LIMIT),
    loadRows(
      userId,
      tripId,
      inArray(notifications.kind, ["message", "covered"]),
      RECENT_LIMIT,
    ),
  ]);
  return {
    mentions: mentions.map(legacyRow),
    notifications: others.map((r) => ({ ...legacyRow(r), kind: r.kind as "message" | "covered" })),
  };
}

/** ADAPTER, removed in H: `unreadMentions` in /api/t/[tripId]/me. */
export async function legacyUnreadMentions(userId: number, tripId: number) {
  const { tags } = await tripCounts(userId, tripId);
  return { gear: tags.gear, shopping: tags.shopping, meals: tags.meals, general: tags.chat };
}

/** ADAPTER, removed in H: the old bell's PATCH, one row and only ever mine. */
export async function markNotificationRead(userId: number, tripId: number, id: number) {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        eq(notifications.tripId, tripId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });
  return { marked: updated.length };
}

/* ------------------------------------------------------------------ prefs */

/**
 * What /me returns: the four switches, plus for one release the old keys a
 * bundle from before the deploy reads (`covered` is lists, `messages` is chat).
 */
export type NotifyPrefs = Required<NotifySwitches> & { covered: boolean; messages: boolean };

export const prefsOf = (u: User): NotifyPrefs => {
  const on = Object.fromEntries(SWITCHES.map((s) => [s, isOn(u, s)])) as Required<NotifySwitches>;
  return { ...on, covered: on.lists, messages: on.chat };
};

/** Old key -> switch, accepted for one release. */
const ALIAS: Record<string, Switch> = { covered: "lists", messages: "chat" };

/**
 * Flip some of my switches. Writes notify_prefs and, for one release, the old
 * booleans too, so the previous bundle reads what this one wrote. Removed in H.
 */
export async function setPrefs(userId: number, body: unknown) {
  const patch: NotifySwitches = {};
  for (const [key, value] of Object.entries((body ?? {}) as Record<string, unknown>)) {
    const s = (SWITCHES as string[]).includes(key) ? (key as Switch) : ALIAS[key];
    if (s && typeof value === "boolean") patch[s] = value;
  }
  if (Object.keys(patch).length === 0) throw new HttpError(400, "אין מה לעדכן");

  const legacy: Partial<Pick<User, "notifyMentions" | "notifyCovered" | "notifyMessages">> = {};
  if (patch.mentions !== undefined) legacy.notifyMentions = patch.mentions;
  if (patch.lists !== undefined) legacy.notifyCovered = patch.lists;
  if (patch.chat !== undefined) legacy.notifyMessages = patch.chat;

  const [row] = await db
    .update(users)
    .set({ ...legacy, notifyPrefs: sql`${users.notifyPrefs} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(users.id, userId))
    .returning();
  return prefsOf(row);
}
