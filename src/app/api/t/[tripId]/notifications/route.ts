import { tripRoute, type TripParams } from "@/lib/access";
import { legacyFeed, markNotificationRead, markRead } from "@/lib/notifications";
import { handle, HttpError } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * ADAPTER for one release, removed in H (docs/roadmap.md): the bell as the
 * bundle before the inbox called it. Same shapes, read from the one table.
 * The current app uses /inbox and /inbox/read.
 */
export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user, canWrite } = await tripRoute(ctx);
    if (!canWrite) return { mentions: [], notifications: [] };
    return legacyFeed(user.id, trip.id);
  });
}

/** "Mark everything read", as /inbox/read with { all: true }. */
export function POST(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    return markRead(user.id, trip.id, { all: true });
  });
}

/** One bell row. */
export function PATCH(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const { id } = (await req.json()) as { id?: number };
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");
    return markNotificationRead(user.id, trip.id, id!);
  });
}
