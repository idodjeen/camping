import { getLeaderboard } from "@/lib/leaderboard";
import { handle, requireReader } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requireReader();
    return getLeaderboard();
  });
}
