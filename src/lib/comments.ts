import { and, asc, desc, eq, inArray, isNull, not } from "drizzle-orm";

import { db } from "@/db";
import { comments, gearItems, meals, notifications, shoppingItems, users } from "@/db/schema";
import { hears, notify } from "@/lib/notifications";
import { EVERYONE } from "@/lib/mention-all";
import { HttpError } from "@/lib/session";
import { SUBJECTS, THREAD, type Subject } from "@/lib/threads";
import { tripPeople } from "@/lib/trips";

export { SUBJECTS, type Subject };

/** A general chat message is one whose three subject columns are all empty. */
const generalOnly = and(
  isNull(comments.gearItemId),
  isNull(comments.shoppingItemId),
  isNull(comments.mealId),
);

/** Maps a subject name onto the one column that holds it. */
const COLUMN = {
  gear: comments.gearItemId,
  shopping: comments.shoppingItemId,
  meal: comments.mealId,
} as const;

export function parseSubject(value: string | null): Subject {
  if (!value || !SUBJECTS.includes(value as Subject)) {
    throw new HttpError(400, "סוג פריט לא מוכר");
  }
  return value as Subject;
}

export type CommentView = {
  id: number;
  body: string;
  createdAt: string;
  /** Set once the author has changed the text: "(נערך)". */
  editedAt: string | null;
  author: { id: number; name: string; slug: string; avatarUrl: string | null };
  mentions: string[];
};

export async function getThread(
  tripId: number,
  subject: Subject,
  subjectId: number,
): Promise<CommentView[]> {
  const rows = await db.query.comments.findMany({
    where: and(eq(comments.tripId, tripId), eq(COLUMN[subject], subjectId)),
    orderBy: [asc(comments.createdAt), asc(comments.id)],
    with: { author: true },
  });

  // Who each message tagged: their tag rows, whoever's they are.
  const tagged =
    rows.length === 0
      ? []
      : await db
          .select({ commentId: notifications.commentId, name: users.name })
          .from(notifications)
          .innerJoin(users, eq(users.id, notifications.userId))
          .where(
            and(
              eq(notifications.tripId, tripId),
              eq(notifications.kind, "mention"),
              inArray(
                notifications.commentId,
                rows.map((c) => c.id),
              ),
            ),
          )
          .orderBy(asc(notifications.id));

  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    author: {
      id: c.author.id,
      name: c.author.name,
      slug: c.author.slug,
      avatarUrl: c.author.avatarUrl,
    },
    mentions: tagged.filter((t) => t.commentId === c.id).map((t) => t.name),
  }));
}

/**
 * Finds who a message is addressed to by scanning the text itself.
 *
 * The composer inserts "@ניר", but the mention rows are derived here rather
 * than taken from what the client claims it picked. That makes the body the
 * single source of truth — deleting "@ניר" before sending genuinely removes
 * the mention — and stops a client fabricating a mention of someone it never
 * displayed.
 *
 * The negative lookahead stops "@ניר" also matching a longer name starting
 * with the same letters.
 */
export function findMentions<P extends { id: number; name: string }>(body: string, people: P[]): P[] {
  const has = (name: string) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, "u").test(body + " ");
  };
  // "@כולם" expands to the whole group. It is still derived from the text, so
  // the author is filtered out by the caller like any other self-mention.
  if (has(EVERYONE)) return people;
  return people.filter((p) => has(p.name));
}

/** The same 400s for sending and editing. */
function cleanBody(raw: string) {
  const body = raw.trim();
  if (!body) throw new HttpError(400, "אי אפשר לשלוח תגובה ריקה");
  if (body.length > 1000) throw new HttpError(400, "התגובה ארוכה מדי");
  return body;
}

/** What every notify() about one comment shares: its thread, its row, its push text. */
function notifyBase(
  tripId: number,
  authorId: number,
  subject: Subject | null,
  subjectId: number | null,
  commentId: number,
  label: string,
  body: string,
) {
  return {
    tripId,
    actorId: authorId,
    thread: subject ? THREAD.item(subject, subjectId!) : THREAD.chat,
    refs: { commentId },
    push: { label, preview: body.length > 120 ? `${body.slice(0, 117)}…` : body },
  };
}

export async function createComment(
  tripId: number,
  authorId: number,
  /** null posts to the general chat, which belongs to no item. */
  subject: Subject | null,
  subjectId: number | null,
  rawBody: string,
) {
  const body = cleanBody(rawBody);

  // A comment on an item from another trip would be refused by the composite
  // FK anyway; checking first turns that 500 into a clean 404.
  const label = subject ? await subjectLabel(tripId, subject, subjectId!) : "צ׳אט כללי";

  // Only this trip's people can be tagged, and only they hear about it.
  const people = await tripPeople(tripId);
  // Mentioning yourself is allowed in the text but never notifies you.
  const mentioned = findMentions(body, people).filter((p) => p.id !== authorId);

  const [created] = await db
    .insert(comments)
    .values({
      tripId,
      // At most one of these is set (none = general chat); the CHECK constraint enforces it.
      gearItemId: subject === "gear" ? subjectId : null,
      shoppingItemId: subject === "shopping" ? subjectId : null,
      mealId: subject === "meal" ? subjectId : null,
      userId: authorId,
      body,
    })
    .returning();

  // Best-effort, like the email: notify() logs and never throws, so losing a
  // bell row can't lose the message.
  const common = notifyBase(tripId, authorId, subject, subjectId, created.id, label, body);
  await notify({ ...common, kind: "mention", to: mentioned.map((p) => p.id) });
  // Everyone else who asked to hear about messages. Not anyone tagged *with*
  // tags switched on: they already have the tag, and two bell rows for one
  // message would just be noise. Someone tagged with tags muted still gets the
  // plain message row, so muting one kind never silences the whole comment.
  await notify({
    ...common,
    kind: "message",
    to: people
      .filter((p) => !mentioned.some((m) => m.id === p.id && hears(p, "mention")))
      .map((p) => p.id),
  });

  return { comment: created, mentioned };
}

/** Which list a comment hangs off, from its three subject columns; null is the general chat. */
const subjectOf = (c: { gearItemId: number | null; shoppingItemId: number | null; mealId: number | null }) =>
  c.gearItemId !== null ? (["gear", c.gearItemId] as const)
  : c.shoppingItemId !== null ? (["shopping", c.shoppingItemId] as const)
  : c.mealId !== null ? (["meal", c.mealId] as const)
  : ([null, null] as const);

/**
 * The author changes their own message. Tags are derived from the text, so
 * they are derived again: people newly named are tagged and hear about it
 * (bell, push, and the caller emails them); people no longer named lose the
 * tag and keep the plain message row they'd have had if never tagged, with the
 * tag's read state; everyone else hears nothing.
 *
 * The row lock serialises two devices editing at once, so the before and after
 * of one edit are never mixed with another's. A body that is the same after
 * trimming changes nothing, not even edited_at.
 */
export async function updateComment(tripId: number, userId: number, commentId: number, rawBody: string) {
  const body = cleanBody(rawBody);
  const people = await tripPeople(tripId);

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.tripId, tripId)))
      .for("update");
    if (!row) throw new HttpError(404, "ההודעה לא נמצאה");
    // Authors only; group admins can delete anyone's message but not put words in it.
    if (row.userId !== userId) throw new HttpError(403, "אפשר לערוך רק הודעות שלך");
    if (row.body === body) return { row, added: [] as typeof people };

    const tags = await tx
      .select({ userId: notifications.userId, readAt: notifications.readAt })
      .from(notifications)
      .where(and(eq(notifications.commentId, commentId), eq(notifications.kind, "mention")));
    const before = new Set(tags.map((t) => t.userId));
    const after = findMentions(body, people).filter((p) => p.id !== userId);
    const added = after.filter((p) => !before.has(p.id));
    const removed = tags.filter((t) => !after.some((p) => p.id === t.userId));

    const [updated] = await tx
      .update(comments)
      .set({ body, editedAt: new Date() })
      .where(eq(comments.id, commentId))
      .returning();

    if (removed.length > 0) {
      await tx.delete(notifications).where(
        and(
          eq(notifications.commentId, commentId),
          eq(notifications.kind, "mention"),
          inArray(notifications.userId, removed.map((r) => r.userId)),
        ),
      );
      // The plain message row they'd have had without the tag, if they hear
      // messages and don't already have one (tagged with tags muted, they do).
      const [subject, subjectId] = subjectOf(row);
      const has = new Set(
        (
          await tx
            .select({ userId: notifications.userId })
            .from(notifications)
            .where(and(eq(notifications.commentId, commentId), eq(notifications.kind, "message")))
        ).map((r) => r.userId),
      );
      const rows = removed.filter((r) => {
        const p = people.find((x) => x.id === r.userId);
        return p && hears(p, "message") && !has.has(r.userId);
      });
      if (rows.length > 0) {
        await tx.insert(notifications).values(
          rows.map((r) => ({
            tripId,
            userId: r.userId,
            kind: "message" as const,
            actorId: userId,
            threadKey: subject ? THREAD.item(subject, subjectId!) : THREAD.chat,
            commentId,
            readAt: r.readAt,
          })),
        );
      }
    }
    return { row: updated, added };
  });

  const { row, added } = result;
  const [subject, subjectId] = subjectOf(row);
  const label = subject ? await subjectLabel(tripId, subject, subjectId!) : "צ׳אט כללי";
  if (added.length > 0) {
    // After the commit, like every notify(): tag rows, and a push to the newly
    // tagged only. The mention index makes a second device's edit a no-op here.
    await notify({
      ...notifyBase(tripId, userId, subject, subjectId, commentId, label, body),
      kind: "mention",
      to: added.map((p) => p.id),
    });
    // The tag replaces their plain message row, as when sending: one bell row
    // per message. Only where the tag row really landed (notify() never throws).
    const hearing = added.filter((p) => hears(p, "mention")).map((p) => p.id);
    const tagged =
      hearing.length === 0
        ? []
        : (
            await db
              .select({ userId: notifications.userId })
              .from(notifications)
              .where(
                and(
                  eq(notifications.commentId, commentId),
                  eq(notifications.kind, "mention"),
                  inArray(notifications.userId, hearing),
                ),
              )
          ).map((r) => r.userId);
    if (tagged.length > 0) {
      await db.delete(notifications).where(
        and(
          eq(notifications.commentId, commentId),
          eq(notifications.kind, "message"),
          inArray(notifications.userId, tagged),
        ),
      );
    }
  }
  return { comment: row, added, label };
}

/**
 * Collapses the three nullable subject columns back into {topic, id, label}
 * so no client ever has to know a thread hangs off one of three foreign keys.
 * All three null is the general chat.
 */
function topicOf(c: {
  gearItemId: number | null;
  shoppingItemId: number | null;
  mealId: number | null;
  gearItem: { name: string } | null;
  shoppingItem: { name: string } | null;
  meal: { title: string } | null;
}): readonly [Topic, number, string] {
  // The label falls back only if the item vanished between the query's join and now.
  if (c.gearItemId !== null) return ["gear", c.gearItemId, c.gearItem?.name ?? "פריט שנמחק"];
  if (c.shoppingItemId !== null)
    return ["shopping", c.shoppingItemId, c.shoppingItem?.name ?? "פריט שנמחק"];
  if (c.mealId !== null) return ["meal", c.mealId, c.meal?.title ?? "פריט שנמחק"];
  return ["general", 0, "צ׳אט כללי"];
}

/** What a chat message is about: one of the lists, or nothing (the general chat). */
export type Topic = Subject | "general";

export type ChatMessage = {
  id: number;
  subject: Topic;
  subjectId: number;
  subjectLabel: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: { id: number; name: string; slug: string; avatarUrl: string | null };
  /** Is this message addressed to me, and have I not opened it yet? */
  taggedMe: boolean;
  unread: boolean;
};

/**
 * Every comment on every item as one conversation, oldest first — or, with
 * `room: "general"`, the general room instead. The two never mix: the item
 * timeline stays only about items, the room only about the crew.
 *
 * The threads stay per-item in the database; this is only a read model that
 * merges them by time. That is deliberate: it means the chat needs no schema
 * change and can never disagree with the sheets on each row — both read the
 * same rows. The newest `limit` are fetched newest-first (so the LIMIT keeps
 * the right end of history) and reversed for display.
 */
export async function listChat(
  tripId: number,
  userId: number,
  room: "items" | "general" = "items",
  limit = 150,
): Promise<ChatMessage[]> {
  const rows = await db.query.comments.findMany({
    where: and(eq(comments.tripId, tripId), room === "general" ? generalOnly : not(generalOnly!)),
    orderBy: [desc(comments.id)],
    limit,
    with: {
      author: true,
      gearItem: true,
      shoppingItem: true,
      meal: true,
    },
  });

  // My tags among these messages, read or not; whatever my switches say, so
  // the ring on a bubble never depends on the bell's settings.
  const myTags =
    rows.length === 0
      ? []
      : await db
          .select({ commentId: notifications.commentId, readAt: notifications.readAt })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, userId),
              eq(notifications.tripId, tripId),
              eq(notifications.kind, "mention"),
              inArray(
                notifications.commentId,
                rows.map((c) => c.id),
              ),
            ),
          );

  return rows.reverse().map((c) => {
    const [subject, subjectId, label] = topicOf(c);
    const mine = myTags.find((m) => m.commentId === c.id);

    return {
      id: c.id,
      subject,
      subjectId,
      subjectLabel: label,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      editedAt: c.editedAt?.toISOString() ?? null,
      author: {
        id: c.author.id,
        name: c.author.name,
        slug: c.author.slug,
        avatarUrl: c.author.avatarUrl,
      },
      taggedMe: mine !== undefined,
      unread: mine !== undefined && mine.readAt === null,
    };
  });
}

export async function deleteComment(
  tripId: number,
  userId: number,
  isAdmin: boolean,
  commentId: number,
) {
  const [row] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.tripId, tripId)));
  if (!row) throw new HttpError(404, "התגובה לא נמצאה");
  // Your own, or anyone's if you're a group admin.
  if (row.userId !== userId && !isAdmin) throw new HttpError(403, "אפשר למחוק רק תגובות שלך");

  await db.delete(comments).where(eq(comments.id, commentId));
  return { deleted: true };
}

/**
 * What the item is called, for the email subject line and the thread header.
 * Also the proof that the item is in this trip: anything else is a 404.
 */
export async function subjectLabel(
  tripId: number,
  subject: Subject,
  subjectId: number,
): Promise<string> {
  const label =
    subject === "gear"
      ? (
          await db
            .select({ label: gearItems.name })
            .from(gearItems)
            .where(and(eq(gearItems.id, subjectId), eq(gearItems.tripId, tripId)))
        )[0]?.label
      : subject === "shopping"
        ? (
            await db
              .select({ label: shoppingItems.name })
              .from(shoppingItems)
              .where(and(eq(shoppingItems.id, subjectId), eq(shoppingItems.tripId, tripId)))
          )[0]?.label
        : (
            await db
              .select({ label: meals.title })
              .from(meals)
              .where(and(eq(meals.id, subjectId), eq(meals.tripId, tripId)))
          )[0]?.label;
  if (label === undefined) throw new HttpError(404, "הפריט לא נמצא");
  return label;
}
