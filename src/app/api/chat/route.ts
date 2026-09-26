import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { createComment, listChat, type ImageUpload } from "@/lib/comments";
import { buildMentionEmails } from "@/lib/emails";
import { PHOTO } from "@/lib/notifications";
import { sendAll } from "@/lib/mailer";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
// Notifying several people means several SMTP handshakes.
export const maxDuration = 60;

/**
 * The item comments as one timeline, or with ?room=general the general room.
 * The viewer only shapes the tag/unread flags.
 */
export function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const room = new URL(req.url).searchParams.get("room") === "general" ? "general" : "items";
    return { messages: await listChat(me.id, room) };
  });
}

/**
 * A message to the whole crew that is not about any item.
 *
 * Same rules as an item comment: the author is the session user, and who got
 * tagged is derived from the text. It just has no subject.
 */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const body = (await req.json()) as { body?: string; image?: ImageUpload | null };
    const { mentioned } = await createComment(me.id, null, null, body.body ?? "", body.image);

    if (mentioned.length > 0) {
      // Best-effort, as with item comments: a mail failure must not lose the message.
      try {
        const recipients = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.id, mentioned.map((m) => m.id)));
        // A photo with no caption would otherwise be a blank email body.
        const text = (body.body ?? "").trim() || PHOTO;
        await sendAll(buildMentionEmails(me.name, "הצ׳אט הכללי", text, recipients));
      } catch (err) {
        console.error("mention email failed", err);
      }
    }

    return { notified: mentioned.map((m) => m.name) };
  });
}
