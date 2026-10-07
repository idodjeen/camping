import { tripRoute, type TripParams } from "@/lib/access";
import { getMeals } from "@/lib/queries";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx);
    return { days: await getMeals(trip.id, user.id) };
  });
}
