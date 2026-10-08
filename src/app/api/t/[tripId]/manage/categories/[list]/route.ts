import { tripRoute } from "@/lib/access";
import { handle } from "@/lib/session";
import { addCategory, parseCategoryName, parseList, parseOrder, reorderCategories } from "@/lib/trip-content";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tripId: string; list: string }> };

/** A new gear or shopping category, at the end. */
export function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx, "admin");
    const list = parseList((await ctx.params).list);
    return addCategory(trip.id, list, parseCategoryName(await req.json().catch(() => null)));
  });
}

/** The whole list in a new order: `{ ids }`. */
export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx, "admin");
    const list = parseList((await ctx.params).list);
    return reorderCategories(trip.id, list, parseOrder(await req.json().catch(() => null)));
  });
}
