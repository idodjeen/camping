import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { shoppingItems } from "@/db/schema";
import { intParam, tripRoute } from "@/lib/access";
import { notify } from "@/lib/notifications";
import { handle, HttpError } from "@/lib/session";
import { THREAD } from "@/lib/threads";

export const dynamic = "force-dynamic";

/**
 * Mark an item bought / not bought.
 *
 * Only the trip's shoppers may do this. The check lives here rather than in
 * the UI: hiding the checkbox stops honest mistakes, this stops everything
 * else. Shopper status is read fresh from `trip_members` per request, so
 * revoking it takes effect immediately.
 */
export function PATCH(req: Request, ctx: { params: Promise<{ tripId: string; id: string }> }) {
  return handle(async () => {
    const { trip, user, isShopper } = await tripRoute(ctx, "write");
    if (!isShopper) throw new HttpError(403, "רק אחראי הקניות של הטיול מסמנים קניות");

    const id = intParam((await ctx.params).id);
    const body = (await req.json()) as { isBought?: boolean };
    const isBought = Boolean(body.isBought);
    const thisOne = and(eq(shoppingItems.id, id), eq(shoppingItems.tripId, trip.id));
    const [before] = await db.select({ isBought: shoppingItems.isBought }).from(shoppingItems).where(thisOne);

    const [updated] = await db
      .update(shoppingItems)
      .set({
        isBought,
        boughtBy: isBought ? user.id : null,
        boughtAt: isBought ? new Date() : null,
      })
      .where(thisOne)
      .returning();
    if (!updated) throw new HttpError(404, "הפריט לא נמצא");

    // Bought only; taking it back sends nothing. One thread for the list, so a
    // shopping run reads as one line ("ניר קנה 12 פריטים"), not twelve.
    if (isBought && !before?.isBought) {
      await notify({
        tripId: trip.id,
        kind: "bought",
        actorId: user.id,
        thread: THREAD.list("shopping"),
        refs: { shoppingItemId: id },
        data: { name: updated.name },
        push: { label: "קניות" },
      });
    }
    return { item: updated };
  });
}
