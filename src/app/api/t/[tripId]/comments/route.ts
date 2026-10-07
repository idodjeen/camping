import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { tripRoute, type TripParams } from "@/lib/access";
import { createComment, getThread, parseSubject, subjectLabel } from "@/lib/comments";
import { buildMentionEmails } from "@/lib/emails";
import { sendAll } from "@/lib/mailer";
import { handle, HttpError } from "@/lib/session";

export const dynamic = "force-dynamic";
// Notifying several people means several SMTP handshakes.
export const maxDuration = 60;

export function GET(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx);
    const url = new URL(req.url);
    const subject = parseSubject(url.searchParams.get("subject"));
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");

    // subjectLabel 404s for an item outside this trip, before any thread is read.
    const label = await subjectLabel(trip.id, subject, id);
    return { comments: await getThread(trip.id, subject, id), label };
  });
}

export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user: me } = await tripRoute(ctx, "write");
    const body = (await req.json()) as { subject?: string; id?: number; body?: string };
    const subject = parseSubject(body.subject ?? null);
    const id = Number(body.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");

    // The author is the session user. Nothing in the request body can change
    // who a comment is from, or who it notifies.
    const { mentioned } = await createComment(trip.id, me.id, subject, id, body.body ?? "");

    if (mentioned.length > 0) {
      // Fire-and-forget on purpose: a missing GMAIL_APP_PASSWORD or an SMTP
      // timeout must not reject the comment. Losing the question because the
      // notification failed would be the worst of both outcomes.
      try {
        const recipients = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.id, mentioned.map((m) => m.id)));
        const label = await subjectLabel(trip.id, subject, id);
        await sendAll(buildMentionEmails(trip.id, me.name, label, body.body!.trim(), recipients));
      } catch (err) {
        console.error("mention email failed", err);
      }
    }

    return {
      comments: await getThread(trip.id, subject, id),
      notified: mentioned.map((m) => m.name),
    };
  });
}
