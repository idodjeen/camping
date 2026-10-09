import { tripRoute, type TripParams } from "@/lib/access";
import { nowInIsrael } from "@/lib/dates";
import { getDashboard } from "@/lib/queries";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx);
    return { trip, ...(await getDashboard(trip.id, nowInIsrael())) };
  });
}
