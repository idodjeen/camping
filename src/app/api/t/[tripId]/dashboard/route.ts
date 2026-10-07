import { tripRoute, type TripParams } from "@/lib/access";
import { SLOT_HOUR, nowInIsrael } from "@/lib/dates";
import { getGear, getMeals, getShopping } from "@/lib/queries";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip } = await tripRoute(ctx);

    const [categories, shopping, days] = await Promise.all([
      getGear(trip.id),
      getShopping(trip.id),
      getMeals(trip.id),
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
      trip,
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
