import { intParam, tripRoute } from "@/lib/access";
import { handle } from "@/lib/session";
import { deleteMeal, parseMeal, updateMeal } from "@/lib/trip-content";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tripId: string; id: string }> };

/** Everything about the meal, including moving it to another day or slot. */
export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "admin");
    const id = intParam((await ctx.params).id);
    return updateMeal(trip.id, id, parseMeal(await req.json().catch(() => null)), user.id);
  });
}

/** The meal with its ingredient links and its thread; the shopping items stay. */
export function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx, "admin");
    return deleteMeal(trip.id, intParam((await ctx.params).id));
  });
}
