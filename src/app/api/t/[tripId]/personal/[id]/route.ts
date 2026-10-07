import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { personalItems } from "@/db/schema";
import { intParam, tripRoute } from "@/lib/access";
import { handle, HttpError } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tripId: string; id: string }> };

/**
 * Every query here is scoped by the row id, the session user's id AND the
 * trip. Matching on id alone would let anyone edit or delete another person's
 * private list by guessing a number.
 */
const mine = (id: number, userId: number, tripId: number) =>
  and(eq(personalItems.id, id), eq(personalItems.userId, userId), eq(personalItems.tripId, tripId));

export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const id = intParam((await ctx.params).id);
    const body = (await req.json()) as { name?: string; isPacked?: boolean; qty?: number | null };

    const patch: { name?: string; isPacked?: boolean; qty?: number | null } = {};
    if (typeof body.isPacked === "boolean") patch.isPacked = body.isPacked;
    if (body.qty === null) patch.qty = null;
    else if (typeof body.qty === "number") {
      if (!Number.isInteger(body.qty) || body.qty < 1 || body.qty > 99) {
        throw new HttpError(400, "כמות בין 1 ל-99");
      }
      patch.qty = body.qty;
    }
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) throw new HttpError(400, "צריך שם לפריט");
      patch.name = name;
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, "אין מה לעדכן");

    const [updated] = await db
      .update(personalItems)
      .set(patch)
      .where(mine(id, user.id, trip.id))
      .returning();
    if (!updated) throw new HttpError(404, "הפריט לא נמצא");
    return { item: updated };
  });
}

export function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const id = intParam((await ctx.params).id);
    const [deleted] = await db
      .delete(personalItems)
      .where(mine(id, user.id, trip.id))
      .returning();
    if (!deleted) throw new HttpError(404, "הפריט לא נמצא");
    return { deleted: true };
  });
}
