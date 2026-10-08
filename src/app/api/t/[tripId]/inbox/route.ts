import { tripRoute, type TripParams } from "@/lib/access";
import { getInbox } from "@/lib/notifications";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * My bell on this trip: unread rows grouped by thread, the read history, and
 * the counts behind the bell, the nav and the app icon.
 *
 * No user id in the request: the session decides whose inbox this is. A
 * viewer reads the trip but gets an empty inbox; nothing on it is theirs.
 */
export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user, canWrite } = await tripRoute(ctx);
    return getInbox(user.id, trip.id, canWrite);
  });
}
