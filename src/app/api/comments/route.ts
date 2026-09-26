import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createComment,
  getThread,
  parseSubject,
  subjectLabel,
  type ImageUpload,
} from "@/lib/comments";
import { buildMentionEmails } from "@/lib/emails";
import { PHOTO } from "@/lib/notifications";
import { sendAll } from "@/lib/mailer";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
// Notifying several people means several SMTP handshakes.
export const maxDuration = 60;

export function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    const url = new URL(req.url);
    const subject = parseSubject(url.searchParams.get("subject"));
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");

    return { comments: await getThread(subject, id), label: await subjectLabel(subject, id) };
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const body = (await req.json()) as {
      subject?: string;
      id?: number;
      body?: string;
      image?: ImageUpload | null;
    };
    const subject = parseSubject(body.subject ?? null);
    const id = Number(body.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");

    // The author is the session user. Nothing in the request body can change
    // who a comment is from, or who it notifies.
    const { mentioned } = await createComment(me.id, subject, id, body.body ?? "", body.image);

    if (mentioned.length > 0) {
      // Fire-and-forget on purpose: a missing GMAIL_APP_PASSWORD or an SMTP
      // timeout must not reject the comment. Losing the question because the
      // notification failed would be the worst of both outcomes.
      try {
        const recipients = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.id, mentioned.map((m) => m.id)));
        const label = await subjectLabel(subject, id);
        // A photo with no caption would otherwise be a blank email body.
        const text = (body.body ?? "").trim() || PHOTO;
        await sendAll(buildMentionEmails(me.name, label, text, recipients));
      } catch (err) {
        console.error("mention email failed", err);
      }
    }

    return { comments: await getThread(subject, id), notified: mentioned.map((m) => m.name) };
  });
}
