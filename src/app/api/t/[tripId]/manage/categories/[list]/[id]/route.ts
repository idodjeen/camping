import { intParam, tripRoute } from "@/lib/access";
import { handle } from "@/lib/session";
import { deleteCategory, parseCategoryName, parseList, renameCategory } from "@/lib/trip-content";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tripId: string; list: string; id: string }> };

export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx, "admin");
    const { list, id } = await ctx.params;
    return renameCategory(trip.id, parseList(list), intParam(id), parseCategoryName(await req.json().catch(() => null)));
  });
}

/** Only an empty category. */
export function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx, "admin");
    const { list, id } = await ctx.params;
    return deleteCategory(trip.id, parseList(list), intParam(id));
  });
}
