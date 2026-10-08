import { intParam, requireGroupAdmin } from "@/lib/access";
import { parseTripMemberChange, setTripMember } from "@/lib/group-admin";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ groupId: string; tripId: string; userId: string }> };

/** Puts a member on this trip or takes them off it, and whether they shop for it. */
export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { groupId, tripId, userId } = await ctx.params;
    const { group } = await requireGroupAdmin(groupId);
    const change = parseTripMemberChange(await req.json().catch(() => null));
    return setTripMember(group.id, intParam(tripId), intParam(userId), change);
  });
}
