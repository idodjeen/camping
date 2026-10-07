import { intParam, tripRoute } from "@/lib/access";
import { deleteComment } from "@/lib/comments";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

export function DELETE(_req: Request, ctx: { params: Promise<{ tripId: string; id: string }> }) {
  return handle(async () => {
    const { trip, user, isAdmin } = await tripRoute(ctx, "write");
    const id = intParam((await ctx.params).id);
    return deleteComment(trip.id, user.id, isAdmin, id);
  });
}
