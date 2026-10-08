import { intParam, requireGroupAdmin } from "@/lib/access";
import { changeRole, parseRole, removeMember } from "@/lib/group-admin";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ groupId: string; userId: string }> };

/** Changes a member's role: admin, editor or viewer. */
export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { groupId, userId } = await ctx.params;
    const { group } = await requireGroupAdmin(groupId);
    const role = parseRole(await req.json().catch(() => null));
    return changeRole(group.id, intParam(userId), role);
  });
}

/** Removes someone from the group and its trips. */
export function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { groupId, userId } = await ctx.params;
    const { group, user: me } = await requireGroupAdmin(groupId);
    return removeMember(group.id, intParam(userId), me.id);
  });
}
