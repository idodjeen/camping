import { and, asc, desc, eq, inArray, isNull, not } from "drizzle-orm";

import { db } from "@/db";
import { commentMentions, comments, gearItems, meals, shoppingItems, users } from "@/db/schema";
import { EVERYONE } from "@/lib/mention-all";
import { HttpError } from "@/lib/session";

export const SUBJECTS = ["gear", "shopping", "meal"] as const;
export type Subject = (typeof SUBJECTS)[number];

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
  author: { id: number; name: string; slug: string; avatarUrl: string | null };
  mentions: string[];
};

export async function getThread(subject: Subject, subjectId: number): Promise<CommentView[]> {
  const rows = await db.query.comments.findMany({
    where: eq(COLUMN[subject], subjectId),
    orderBy: [asc(comments.createdAt), asc(comments.id)],
    with: { author: true, mentions: { with: { user: true } } },
  });

  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: {
      id: c.author.id,
      name: c.author.name,
      slug: c.author.slug,
      avatarUrl: c.author.avatarUrl,
    },
    mentions: c.mentions.map((m) => m.user.name),
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
export function findMentions(body: string, people: { id: number; name: string }[]) {
  const has = (name: string) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, "u").test(body + " ");
  };
  // "@כולם" expands to the whole group. It is still derived from the text, so
  // the author is filtered out by the caller like any other self-mention.
  if (has(EVERYONE)) return people;
  return people.filter((p) => has(p.name));
}

export async function createComment(
  authorId: number,
  /** null posts to the general chat, which belongs to no item. */
  subject: Subject | null,
  subjectId: number | null,
  rawBody: string,
) {
  const body = rawBody.trim();
  if (!body) throw new HttpError(400, "אי אפשר לשלוח תגובה ריקה");
  if (body.length > 1000) throw new HttpError(400, "התגובה ארוכה מדי");

  const people = await db.select().from(users);
  // Mentioning yourself is allowed in the text but never notifies you.
  const mentioned = findMentions(body, people).filter((p) => p.id !== authorId);

  const [created] = await db
    .insert(comments)
    .values({
      // At most one of these is set (none = general chat); the CHECK constraint enforces it.
      gearItemId: subject === "gear" ? subjectId : null,
      shoppingItemId: subject === "shopping" ? subjectId : null,
      mealId: subject === "meal" ? subjectId : null,
      userId: authorId,
      body,
    })
    .returning();

  if (mentioned.length > 0) {
    await db
      .insert(commentMentions)
      .values(mentioned.map((p) => ({ commentId: created.id, userId: p.id })))
      .onConflictDoNothing();
  }

  return { comment: created, mentioned };
}

/** Marks my own unread mentions in one thread as read. */
export async function markThreadRead(userId: number, subject: Subject, subjectId: number) {
  const ids = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(COLUMN[subject], subjectId));
  if (ids.length === 0) return { marked: 0 };

  const updated = await db
    .update(commentMentions)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(commentMentions.userId, userId),
        isNull(commentMentions.readAt),
        inArray(
          commentMentions.commentId,
          ids.map((r) => r.id),
        ),
      ),
    )
    .returning();

  return { marked: updated.length };
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

export type MentionView = {
  /** The mention row, not the comment — two people tagged in one comment get one each. */
  id: number;
  subject: Topic;
  /** 0 for the general chat, which has no item. */
  subjectId: number;
  /** The item's own name, so the pane can say what the message is about. */
  subjectLabel: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  author: { id: number; name: string; slug: string; avatarUrl: string | null };
};

/**
 * Every message I have been tagged in, newest first — read ones included.
 *
 * Ordered by the mention's own id rather than the comment's timestamp: the row
 * is inserted in the same request that creates the comment, so the sequence is
 * already in send order, and a serial primary key sorts without touching the
 * joined table. Read mentions stay in the list because the pane is a history,
 * not an inbox you empty.
 *
 */
export async function listMentions(userId: number, limit = 40): Promise<MentionView[]> {
  const rows = await db.query.commentMentions.findMany({
    where: eq(commentMentions.userId, userId),
    orderBy: [desc(commentMentions.id)],
    limit,
    with: {
      comment: { with: { author: true, gearItem: true, shoppingItem: true, meal: true } },
    },
  });

  return rows.map((m) => {
    const c = m.comment;
    const [subject, subjectId, label] = topicOf(c);

    return {
      id: m.id,
      subject,
      subjectId,
      subjectLabel: label,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
      author: {
        id: c.author.id,
        name: c.author.name,
        slug: c.author.slug,
        avatarUrl: c.author.avatarUrl,
      },
    };
  });
}

export type ChatMessage = {
  id: number;
  subject: Topic;
  subjectId: number;
  subjectLabel: string;
  body: string;
  createdAt: string;
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
  userId: number,
  room: "items" | "general" = "items",
  limit = 150,
): Promise<ChatMessage[]> {
  const rows = await db.query.comments.findMany({
    where: room === "general" ? generalOnly : not(generalOnly!),
    orderBy: [desc(comments.id)],
    limit,
    with: {
      author: true,
      gearItem: true,
      shoppingItem: true,
      meal: true,
      mentions: true,
    },
  });

  return rows.reverse().map((c) => {
    const [subject, subjectId, label] = topicOf(c);
    const mine = c.mentions.find((m) => m.userId === userId);

    return {
      id: c.id,
      subject,
      subjectId,
      subjectLabel: label,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
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

/** Marks my unread tags in the general chat as read — what opening the chat tab does. */
export async function markGeneralRead(userId: number) {
  const general = await db
    .select({ id: comments.id })
    .from(comments)
    .where(generalOnly);
  if (general.length === 0) return { marked: 0 };

  const updated = await db
    .update(commentMentions)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(commentMentions.userId, userId),
        isNull(commentMentions.readAt),
        inArray(
          commentMentions.commentId,
          general.map((r) => r.id),
        ),
      ),
    )
    .returning();

  return { marked: updated.length };
}

/** Clears every unread mention of mine at once, from the pane's "mark all read". */
export async function markAllMentionsRead(userId: number) {
  const updated = await db
    .update(commentMentions)
    .set({ readAt: new Date() })
    .where(and(eq(commentMentions.userId, userId), isNull(commentMentions.readAt)))
    .returning();

  return { marked: updated.length };
}

/** Unread mentions per list, for the dot on the bottom nav. */
export async function unreadMentions(userId: number) {
  const rows = await db
    .select({
      gear: comments.gearItemId,
      shopping: comments.shoppingItemId,
      meal: comments.mealId,
    })
    .from(commentMentions)
    .innerJoin(comments, eq(comments.id, commentMentions.commentId))
    .where(and(eq(commentMentions.userId, userId), isNull(commentMentions.readAt)));

  return {
    gear: rows.filter((r) => r.gear !== null).length,
    shopping: rows.filter((r) => r.shopping !== null).length,
    meals: rows.filter((r) => r.meal !== null).length,
    general: rows.filter((r) => r.gear === null && r.shopping === null && r.meal === null).length,
  };
}

export async function deleteComment(userId: number, isAdmin: boolean, commentId: number) {
  const [row] = await db.select().from(comments).where(eq(comments.id, commentId));
  if (!row) throw new HttpError(404, "התגובה לא נמצאה");
  // Your own, or anyone's if you're the admin.
  if (row.userId !== userId && !isAdmin) throw new HttpError(403, "אפשר למחוק רק תגובות שלך");

  await db.delete(comments).where(eq(comments.id, commentId));
  return { deleted: true };
}

/** What the item is called, for the email subject line and the thread header. */
export async function subjectLabel(subject: Subject, subjectId: number): Promise<string> {
  if (subject === "gear") {
    const [r] = await db.select().from(gearItems).where(eq(gearItems.id, subjectId));
    return r?.name ?? "פריט";
  }
  if (subject === "shopping") {
    const [r] = await db.select().from(shoppingItems).where(eq(shoppingItems.id, subjectId));
    return r?.name ?? "פריט";
  }
  const [r] = await db.select().from(meals).where(eq(meals.id, subjectId));
  return r?.title ?? "ארוחה";
}
