import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { expenses } from "@/db/schema";
import { intParam, tripRoute } from "@/lib/access";
import { handle, HttpError } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tripId: string; id: string }> };

/**
 * Whoever entered it, whoever paid, or a group admin. Shares cascade with the
 * row, and balances are derived from what remains, so nothing else needs fixing up.
 */
export function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user: me, isAdmin } = await tripRoute(ctx, "write");
    const id = intParam((await ctx.params).id);
    const thisOne = and(eq(expenses.id, id), eq(expenses.tripId, trip.id));

    const [expense] = await db.select().from(expenses).where(thisOne);
    if (!expense) throw new HttpError(404, "ההוצאה לא נמצאה");
    if (!isAdmin && expense.createdBy !== me.id && expense.paidBy !== me.id) {
      throw new HttpError(403, "אפשר למחוק רק הוצאה שהוספת או ששילמת");
    }

    await db.delete(expenses).where(thisOne);
    return { deleted: true };
  });
}
