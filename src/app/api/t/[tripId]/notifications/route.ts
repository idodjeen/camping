import { tripRoute, type TripParams } from "@/lib/access";
import { listMentions, listNotifications, markAllMentionsRead } from "@/lib/comments";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { handle, HttpError } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * My bell on this trip: the tags that name me, plus the messages and "covered"
 * events I asked to hear about, each newest first. The pane merges them by time.
 *
 * There is no user id in the request anywhere; the session decides whose feed
 * this is, exactly like /me. Asking for someone else's is not a permission
 * check that can be got wrong, it is unexpressible.
 */
export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx);
    const [mentions, notifications] = await Promise.all([
      listMentions(user.id, trip.id),
      listNotifications(user.id, trip.id),
    ]);
    return { mentions, notifications };
  });
}

/** "Mark everything read" from the pane. Only ever my own rows, on this trip. */
export function POST(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx);
    const [a, b] = await Promise.all([
      markAllMentionsRead(user.id, trip.id),
      markAllNotificationsRead(user.id, trip.id),
    ]);
    return { marked: a.marked + b.marked };
  });
}

/** Opening one bell row marks just that row read. */
export function PATCH(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx);
    const { id } = (await req.json()) as { id?: number };
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");
    return markNotificationRead(user.id, trip.id, id!);
  });
}
