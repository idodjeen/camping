import { groupRoute, type GroupParams } from "@/lib/access";
import { groupDetail } from "@/lib/group-admin";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The group, its people, and its trips with who is on each. Group admins only. */
export function GET(_req: Request, ctx: GroupParams) {
  return handle(async () => {
    const { group } = await groupRoute(ctx);
    return groupDetail(group.id);
  });
}
