import { tripRoute, type TripParams } from "@/lib/access";
import { handle } from "@/lib/session";
import { getForecast } from "@/lib/weather";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx);
    return getForecast(trip.id);
  });
}
