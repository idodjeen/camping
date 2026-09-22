import { eq } from "drizzle-orm";

import { db } from "@/db";
import { trip } from "@/db/schema";
import { SLOT_HOUR, nowInIsrael } from "@/lib/dates";
import { getGear, getMeals, getShopping } from "@/lib/queries";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requireUser();

    const [[t], categories, shopping, days] = await Promise.all([
      db.select().from(trip).where(eq(trip.id, 1)),
      getGear(),
      getShopping(),
      getMeals(),
    ]);

    const gearItems = categories.flatMap((c) =>
      c.items.map((i) => ({ ...i, categoryName: c.name })),
    );
    // Optional items are excluded from the denominator: the ring should show
    // how close the trip is to being *equipped*, and משחקי קופסה never blocks that.
    const required = gearItems.filter((i) => !i.isOptional);
    const shoppingItems = shopping.flatMap((c) => c.items);

    const now = nowInIsrael();
    const nextMeal =
      days
        .flatMap((d) => d.meals.map((m) => ({ ...m, date: d.date })))
        .find((m) => `${m.date}T${SLOT_HOUR[m.slot]}` >= now) ?? null;

    return {
      trip: t ?? null,
      progress: {
        gear: { done: required.filter((i) => i.isFull).length, total: required.length },
        shopping: {
          done: shoppingItems.filter((i) => i.isBought).length,
          total: shoppingItems.length,
        },
      },
      nextMeal,
      unclaimed: required
        .filter((i) => !i.isFull)
        .map((i) => ({
          id: i.id,
          name: i.name,
          qtyLabel: i.qtyLabel,
          remaining: i.remaining,
          categoryName: i.categoryName,
        })),
    };
  });
}
