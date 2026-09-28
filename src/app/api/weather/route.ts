import { getForecast } from "@/lib/weather";
import { handle, requireReader } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requireReader();
    return getForecast();
  });
}
