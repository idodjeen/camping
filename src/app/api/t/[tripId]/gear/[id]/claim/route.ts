import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { gearClaims } from "@/db/schema";
import { intParam, tripRoute } from "@/lib/access";
import { assertGearItem, changeClaim } from "@/lib/gear";
import { handle, HttpError } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tripId: string; id: string }> };

export function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const itemId = intParam((await ctx.params).id);

    const body = (await req.json()) as { qty?: number };
    // qty of 0 or less means "release" - simpler for the client than a separate
    // endpoint, and it makes the stepper's last decrement natural.
    return changeClaim(trip.id, user.id, itemId, Math.floor(body.qty ?? 1));
  });
}

/** Toggle the "packed" flag on my own claim. */
export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const itemId = intParam((await ctx.params).id);
    await assertGearItem(trip.id, itemId);
    const body = (await req.json()) as { isPacked?: boolean };

    const [updated] = await db
      .update(gearClaims)
      .set({ isPacked: Boolean(body.isPacked) })
      .where(and(eq(gearClaims.gearItemId, itemId), eq(gearClaims.userId, user.id)))
      .returning();
    if (!updated) throw new HttpError(404, "לא מצאנו את ההתחייבות שלך");
    return { claim: updated };
  });
}

/** Release my claim: the same locked path as POST with qty 0. */
export function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const itemId = intParam((await ctx.params).id);
    return changeClaim(trip.id, user.id, itemId, 0);
  });
}
