import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { gearClaims, gearItems } from "@/db/schema";
import { notify } from "@/lib/notifications";
import { HttpError } from "@/lib/session";
import { THREAD } from "@/lib/threads";

/**
 * Claim, change or release (qty <= 0) an amount of a gear item. The one path
 * for every change to my claim, so "covered" and "short again" are decided in
 * one place.
 *
 * Kept out of the route handler so the concurrency behaviour can be tested
 * directly, without standing up an HTTP request and a signed session.
 *
 * The transaction takes a row lock on the gear item (`FOR UPDATE`). Without it,
 * two people claiming the last gas stove simultaneously would both read
 * `remaining = 1`, both pass the check, and both insert — leaving 3 stoves
 * claimed 4 times. The lock serialises the two transactions so the second one
 * observes the first's claim and is refused. It also makes "was it full before
 * this change, is it full after" a true before and after.
 */
export async function changeClaim(tripId: number, userId: number, itemId: number, qty: number) {
  const release = qty <= 0;
  if (qty > 99) throw new HttpError(400, "כמות גדולה מדי");

  const { event, result } = await db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(gearItems)
      .where(and(eq(gearItems.id, itemId), eq(gearItems.tripId, tripId)))
      .for("update");
    if (!item) throw new HttpError(404, "הפריט לא נמצא");

    const [{ others }] = await tx
      .select({ others: sql<number>`coalesce(sum(${gearClaims.qty}), 0)::int` })
      .from(gearClaims)
      .where(and(eq(gearClaims.gearItemId, itemId), ne(gearClaims.userId, userId)));
    const [before] = await tx
      .select({ qty: gearClaims.qty })
      .from(gearClaims)
      .where(and(eq(gearClaims.gearItemId, itemId), eq(gearClaims.userId, userId)));

    const capacity = item.qtyNeeded ?? 1;
    if (!release && !item.isOpenQuantity && others + qty > capacity) {
      const left = Math.max(capacity - others, 0);
      throw new HttpError(409, left === 0 ? "מישהו הספיק לפניך — הפריט מכוסה" : `נשארו רק ${left}`);
    }

    let result;
    if (release) {
      await tx
        .delete(gearClaims)
        .where(and(eq(gearClaims.gearItemId, itemId), eq(gearClaims.userId, userId)));
      result = { released: true as const };
    } else {
      const [claim] = await tx
        .insert(gearClaims)
        .values({ gearItemId: itemId, userId, qty })
        .onConflictDoUpdate({
          target: [gearClaims.gearItemId, gearClaims.userId],
          set: { qty },
        })
        .returning();
      result = { claim };
    }

    // Only a capped, required item is ever announced. A re-tap of the same
    // amount, or raising an already-full item, changes neither side.
    if (item.isOpenQuantity || item.isOptional) return { event: null, result };
    const wasFull = others + (before?.qty ?? 0) >= capacity;
    const after = others + (release ? 0 : qty);
    const isFull = after >= capacity;
    const event =
      !wasFull && isFull ? { kind: "covered" as const, name: item.name, missing: 0 }
      : wasFull && !isFull ? { kind: "uncovered" as const, name: item.name, missing: capacity - after }
      : null;
    return { event, result };
  });

  // Only after the transaction commits: a rolled-back claim must not reach
  // anyone's bell or phone, and nothing slow should hold the row lock.
  if (event?.kind === "covered") {
    await notify({
      tripId,
      kind: "covered",
      actorId: userId,
      thread: THREAD.item("gear", itemId),
      refs: { gearItemId: itemId },
      push: { label: event.name, preview: `לקח/ה את האחרון: ${event.name}` },
    });
  } else if (event?.kind === "uncovered") {
    await notify({
      tripId,
      kind: "uncovered",
      actorId: userId,
      thread: THREAD.item("gear", itemId),
      refs: { gearItemId: itemId },
      data: { missing: event.missing },
      push: { label: event.name },
    });
  }
  return result;
}

/**
 * Proves a gear item is in this trip, or 404s.
 *
 * `gear_claims` has no trip_id of its own: the item is what scopes a claim,
 * so every claim write checks the item first. Otherwise a member of one trip
 * could reach a claim in another by guessing an item id.
 */
export async function assertGearItem(tripId: number, itemId: number) {
  const [item] = await db
    .select({ id: gearItems.id })
    .from(gearItems)
    .where(and(eq(gearItems.id, itemId), eq(gearItems.tripId, tripId)));
  if (!item) throw new HttpError(404, "הפריט לא נמצא");
}
