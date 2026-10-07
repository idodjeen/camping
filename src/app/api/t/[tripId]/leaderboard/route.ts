import { tripRoute, type TripParams } from "@/lib/access";
import { getLeaderboard } from "@/lib/leaderboard";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx);
    return getLeaderboard(trip.id);
  });
}
