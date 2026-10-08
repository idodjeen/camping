import { tripRoute, type TripParams } from "@/lib/access";
import { handle } from "@/lib/session";
import { createMeal, parseMeal } from "@/lib/trip-content";

export const dynamic = "force-dynamic";

/** A new meal in a free slot, with its ingredients. */
export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "admin");
    return createMeal(trip.id, parseMeal(await req.json().catch(() => null)), user.id);
  });
}
