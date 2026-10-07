import { tripRoute, type TripParams } from "@/lib/access";
import { markThreadRead, parseSubject } from "@/lib/comments";
import { handle, HttpError } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Clears my own unread mentions in one thread. Never anyone else's. */
export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx);
    const body = (await req.json()) as { subject?: string; id?: number };
    const subject = parseSubject(body.subject ?? null);
    const id = Number(body.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");

    return markThreadRead(user.id, trip.id, subject, id);
  });
}
