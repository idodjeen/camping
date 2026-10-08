import { tripRoute, type TripParams } from "@/lib/access";
import { markRead, type ReadRequest } from "@/lib/notifications";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * `{ thread, upTo? }` reads one thread, `{ all: true, upTo? }` the whole bell.
 * A write like any other, so viewers get 403. Only ever my own rows.
 */
export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const body = (await req.json().catch(() => ({}))) as ReadRequest;
    return markRead(user.id, trip.id, body);
  });
}
