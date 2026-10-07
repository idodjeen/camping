import { tripRoute, type TripParams } from "@/lib/access";
import { markGeneralRead } from "@/lib/comments";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Opening the chat tab clears my own unread tags in this trip's general chat.
 * Only ever my own rows, so reading is enough: a viewer may clear theirs too.
 */
export function POST(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx);
    return markGeneralRead(user.id, trip.id);
  });
}
