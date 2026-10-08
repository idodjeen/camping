import { groupRoute, type GroupParams } from "@/lib/access";
import { addMembers, parseNewMembers } from "@/lib/group-admin";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Adds a pasted list of people as editors or viewers. */
export function POST(req: Request, ctx: GroupParams) {
  return handle(async () => {
    const { group, user: me } = await groupRoute(ctx);
    const input = parseNewMembers(await req.json().catch(() => null));
    return addMembers(group.id, input, me.id);
  });
}
