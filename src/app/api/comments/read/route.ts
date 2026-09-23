import { markThreadRead, parseSubject } from "@/lib/comments";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Clears my own unread mentions in one thread. Never anyone else's. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const body = (await req.json()) as { subject?: string; id?: number };
    const subject = parseSubject(body.subject ?? null);
    const id = Number(body.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");

    return markThreadRead(me.id, subject, id);
  });
}
