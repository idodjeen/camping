import { groupRoute, type GroupParams } from "@/lib/access";
import { createTrip, parseNewTrip } from "@/lib/group-admin";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

/** A new trip, from the template or a copy of an earlier one in the group. */
export function POST(req: Request, ctx: GroupParams) {
  return handle(async () => {
    const { group, user: me } = await groupRoute(ctx);
    const input = parseNewTrip(await req.json().catch(() => null));
    return createTrip(group.id, input, me.id);
  });
}
