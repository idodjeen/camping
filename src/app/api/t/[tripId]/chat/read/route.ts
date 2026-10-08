import { tripRoute, type TripParams } from "@/lib/access";
import { markRead } from "@/lib/notifications";
import { handle } from "@/lib/session";
import { THREAD } from "@/lib/threads";

export const dynamic = "force-dynamic";

/** ADAPTER for one release, removed in H: an older bundle opening the room. */
export function POST(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    return markRead(user.id, trip.id, { thread: THREAD.chat });
  });
}
