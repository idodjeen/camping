import { tripRoute, type TripParams } from "@/lib/access";
import { handle } from "@/lib/session";
import { manageView, parseTripEdit, updateTripDetails } from "@/lib/trip-content";

export const dynamic = "force-dynamic";

/** Everything the manage screen edits: details, categories, shopping items, meals. Admins only. */
export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx, "admin");
    return manageView(trip);
  });
}

/** The trip's name, dates and location; `shiftMeals` moves the meals with the start date. */
export function PATCH(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx, "admin");
    return updateTripDetails(trip.id, parseTripEdit(await req.json().catch(() => null)));
  });
}
