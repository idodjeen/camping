import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { commentMentions, comments, gearItems, meals, shoppingItems, users } from "@/db/schema";
import { HttpError } from "@/lib/session";

export const SUBJECTS = ["gear", "shopping", "meal"] as const;
export type Subject = (typeof SUBJECTS)[number];

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
  return people.filter((p) => {
    const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, "u").test(body + " ");
  });
}

export async function createComment(
  authorId: number,
  subject: Subject,
  subjectId: number,
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
      // Exactly one of these is set; the CHECK constraint enforces it in the DB.
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
