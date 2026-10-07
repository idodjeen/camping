import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { shoppingItems } from "@/db/schema";
import { intParam, tripRoute } from "@/lib/access";
import { handle, HttpError } from "@/lib/session";

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
    if (!isShopper) throw new HttpError(403, "רק עידו וניר מסמנים קניות");

    const id = intParam((await ctx.params).id);
    const body = (await req.json()) as { isBought?: boolean };
    const isBought = Boolean(body.isBought);

    const [updated] = await db
      .update(shoppingItems)
      .set({
        isBought,
        boughtBy: isBought ? user.id : null,
        boughtAt: isBought ? new Date() : null,
      })
      .where(and(eq(shoppingItems.id, id), eq(shoppingItems.tripId, trip.id)))
      .returning();
    if (!updated) throw new HttpError(404, "הפריט לא נמצא");

    return { item: updated };
  });
}
