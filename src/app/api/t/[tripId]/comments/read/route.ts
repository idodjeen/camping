import { tripRoute, type TripParams } from "@/lib/access";
import { parseSubject } from "@/lib/comments";
import { markRead } from "@/lib/notifications";
import { handle, HttpError } from "@/lib/session";
import { THREAD } from "@/lib/threads";

export const dynamic = "force-dynamic";

/**
 * ADAPTER for one release, removed in H: an older bundle opening a thread.
 * Now reads the whole thread, as /inbox/read does.
 */
export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const body = (await req.json()) as { subject?: string; id?: number };
    const subject = parseSubject(body.subject ?? null);
    const id = Number(body.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");

    return markRead(user.id, trip.id, { thread: THREAD.item(subject, id) });
  });
}
