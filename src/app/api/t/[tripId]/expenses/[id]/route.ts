import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { expenseShares, expenses } from "@/db/schema";
import { intParam, tripRoute } from "@/lib/access";
import { parseExpenseInput } from "@/lib/expense-input";
import { splitEqually } from "@/lib/expenses";
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

/**
 * Edit any field: only whoever entered it, or a group admin. Unlike DELETE,
 * the payer alone may not, because an edit can move money onto other people.
 *
 * A new amount or split re-runs splitEqually() and replaces the stored shares
 * in the same transaction. Balances and the payment list are derived on every
 * read, so recorded payments stay as they are and the totals just recompute.
 */
export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user: me, isAdmin } = await tripRoute(ctx, "write");
    const id = intParam((await ctx.params).id);
    const thisOne = and(eq(expenses.id, id), eq(expenses.tripId, trip.id));

    const [expense] = await db.select().from(expenses).where(thisOne);
    if (!expense) throw new HttpError(404, "ההוצאה לא נמצאה");
    if (!isAdmin && expense.createdBy !== me.id) {
      throw new HttpError(403, "אפשר לערוך רק הוצאה שהוספת");
    }

    const input = await parseExpenseInput(await req.json().catch(() => null), {
      tripId: trip.id,
      me: me.id,
      partial: true,
    });
    const { sharedWith, ...fields } = input;
    const resplit = input.amount !== undefined || sharedWith !== undefined;

    const updated = await db.transaction(async (tx) => {
      // Matching on the trip again means a delete from another device in the
      // meantime comes back as no row, not as an edit of nothing.
      const [row] = await tx
        .update(expenses)
        .set({ ...fields, editedAt: new Date() })
        .where(thisOne)
        .returning();
      if (!row || !resplit) return row;

      const people =
        sharedWith ??
        (
          await tx
            .select({ userId: expenseShares.userId })
            .from(expenseShares)
            .where(eq(expenseShares.expenseId, id))
        ).map((s) => s.userId);
      if (people.length === 0) throw new HttpError(400, "צריך לבחור עם מי לחלק");

      await tx.delete(expenseShares).where(eq(expenseShares.expenseId, id));
      await tx
        .insert(expenseShares)
        .values(
          [...splitEqually(row.amount, people)].map(([userId, share]) => ({
            expenseId: id,
            userId,
            amount: share,
          })),
        );
      return row;
    });

    if (!updated) throw new HttpError(404, "ההוצאה לא נמצאה");
    return { expense: updated };
  });
}
