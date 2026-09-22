import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { gearClaims, gearItems } from "@/db/schema";
import { HttpError } from "@/lib/session";

/**
 * Claim, change or release an amount of a gear item.
 *
 * Kept out of the route handler so the concurrency behaviour can be tested
 * directly, without standing up an HTTP request and a signed session.
 *
 * The transaction takes a row lock on the gear item (`FOR UPDATE`). Without it,
 * two people claiming the last gas stove simultaneously would both read
 * `remaining = 1`, both pass the check, and both insert — leaving 3 stoves
 * claimed 4 times. The lock serialises the two transactions so the second one
 * observes the first's claim and is refused.
 */
export async function setClaim(userId: number, itemId: number, qty: number) {
  if (qty <= 0) {
    await db
      .delete(gearClaims)
      .where(and(eq(gearClaims.gearItemId, itemId), eq(gearClaims.userId, userId)));
    return { released: true as const };
  }
  if (qty > 99) throw new HttpError(400, "כמות גדולה מדי");

  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(gearItems)
      .where(eq(gearItems.id, itemId))
      .for("update");
    if (!item) throw new HttpError(404, "הפריט לא נמצא");

    if (!item.isOpenQuantity) {
      const [{ total }] = await tx
        .select({ total: sql<number>`coalesce(sum(${gearClaims.qty}), 0)::int` })
        .from(gearClaims)
        .where(and(eq(gearClaims.gearItemId, itemId), ne(gearClaims.userId, userId)));

      const capacity = item.qtyNeeded ?? 1;
      if (total + qty > capacity) {
        const left = Math.max(capacity - total, 0);
        throw new HttpError(
          409,
          left === 0 ? "מישהו הספיק לפניך — הפריט מכוסה" : `נשארו רק ${left}`,
        );
      }
    }

    const [claim] = await tx
      .insert(gearClaims)
      .values({ gearItemId: itemId, userId, qty })
      .onConflictDoUpdate({
        target: [gearClaims.gearItemId, gearClaims.userId],
        set: { qty },
      })
      .returning();

    return { claim };
  });
}
