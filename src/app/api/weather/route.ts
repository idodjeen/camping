import { getForecast } from "@/lib/weather";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requireUser();
    return getForecast();
  });
}
