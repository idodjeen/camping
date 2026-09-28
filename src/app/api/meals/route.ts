import { getMeals } from "@/lib/queries";
import { handle, requireReader } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const me = await requireReader();
    return { days: await getMeals(me.id) };
  });
}
