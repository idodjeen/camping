import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notifications, users, type Comment, type User } from "@/db/schema";
import { sendPushLater } from "@/lib/push";
import { HttpError } from "@/lib/session";

/** How a message that is only a photo words itself outside the chat. */
export const PHOTO = "📷 תמונה";

/** Either the top-level client or a transaction — both can insert. */
type Writer = Pick<typeof db, "insert" | "select">;

/**
 * Someone posted a message: tell everyone who asked to hear about messages.
 *
 * Not the author, and not anyone who was tagged *and* has tags switched on —
 * they already get a mention row for this comment, and two bell rows for one
 * message would just be noise. Someone tagged with tags muted still gets the
 * plain message row, so muting one kind never silences the whole comment.
 */
export async function notifyMessage(
  comment: Comment,
  authorId: number,
  people: User[],
  mentionedIds: number[],
) {
  const recipients = people.filter(
    (p) =>
      p.id !== authorId &&
      p.notifyMessages &&
      !(mentionedIds.includes(p.id) && p.notifyMentions),
  );
  const author = people.find((p) => p.id === authorId);
  // A photo with no caption still has to read as something in a push banner.
  const text = comment.body || (comment.imagePublicId ? PHOTO : "");
  const preview = text.length > 120 ? `${text.slice(0, 117)}…` : text;
  const url = comment.gearItemId
    ? "/gear"
    : comment.shoppingItemId
      ? "/shopping"
      : comment.mealId
        ? "/meals"
        : "/chat";

  if (recipients.length > 0) {
    await db.insert(notifications).values(
      recipients.map((p) => ({
        userId: p.id,
        kind: "message" as const,
        actorId: authorId,
        commentId: comment.id,
      })),
    );
  }

  // Pushes mirror the bell exactly: a message row for the recipients above,
  // and a separate "tagged you" push for mentioned people who kept tags on.
  sendPushLater(
    recipients.map((p) => p.id),
    { title: author?.name ?? "הודעה חדשה", body: preview, url, tag: `comment-${comment.id}` },
  );
  sendPushLater(
    people.filter((p) => p.id !== authorId && mentionedIds.includes(p.id) && p.notifyMentions).map((p) => p.id),
    { title: `${author?.name ?? "מישהו"} תייג אותך`, body: preview, url, tag: `comment-${comment.id}-mention` },
  );
}

/** An item just reached full coverage; `actorId` is whoever took the last unit. */
export async function notifyCovered(tx: Writer, itemId: number, actorId: number): Promise<number[]> {
  const recipients = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.notifyCovered, true));

  const others = recipients.filter((r) => r.id !== actorId);
  if (others.length === 0) return [];

  await tx.insert(notifications).values(
    others.map((r) => ({
      userId: r.id,
      kind: "covered" as const,
      actorId,
      gearItemId: itemId,
    })),
  );
  return others.map((r) => r.id);
}

export async function markAllNotificationsRead(userId: number) {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return { marked: updated.length };
}

/** One row, and only ever mine — the `userId` in the WHERE is the permission check. */
export async function markNotificationRead(userId: number, id: number) {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return { marked: updated.length };
}

export type NotifyPrefs = { mentions: boolean; covered: boolean; messages: boolean };

export const prefsOf = (u: User): NotifyPrefs => ({
  mentions: u.notifyMentions,
  covered: u.notifyCovered,
  messages: u.notifyMessages,
});

export async function setPrefs(userId: number, patch: Partial<NotifyPrefs>) {
  const set: Partial<Pick<User, "notifyMentions" | "notifyCovered" | "notifyMessages">> = {};
  if (typeof patch.mentions === "boolean") set.notifyMentions = patch.mentions;
  if (typeof patch.covered === "boolean") set.notifyCovered = patch.covered;
  if (typeof patch.messages === "boolean") set.notifyMessages = patch.messages;
  if (Object.keys(set).length === 0) throw new HttpError(400, "אין מה לעדכן");

  const [row] = await db.update(users).set(set).where(eq(users.id, userId)).returning();
  return prefsOf(row);
}
