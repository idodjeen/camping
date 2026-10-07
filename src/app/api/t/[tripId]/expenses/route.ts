import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { expenseShares, expenses, settlements } from "@/db/schema";
import { tripRoute, type TripParams } from "@/lib/access";
import { parseExpenseInput } from "@/lib/expense-input";
import { computeBalances, simplifyDebts, splitEqually } from "@/lib/expenses";
import { handle } from "@/lib/session";
import { tripPeople } from "@/lib/trips";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user: me, isAdmin, canWrite } = await tripRoute(ctx);

    const tripExpenses = db
      .select({ id: expenses.id })
      .from(expenses)
      .where(eq(expenses.tripId, trip.id));

    const [members, expenseRows, shareRows, settlementRows] = await Promise.all([
      tripPeople(trip.id),
      db
        .select()
        .from(expenses)
        .where(eq(expenses.tripId, trip.id))
        .orderBy(desc(expenses.createdAt), desc(expenses.id)),
      db.select().from(expenseShares).where(inArray(expenseShares.expenseId, tripExpenses)),
      db
        .select()
        .from(settlements)
        .where(eq(settlements.tripId, trip.id))
        .orderBy(desc(settlements.createdAt), desc(settlements.id)),
    ]);

    const sharesByExpense = new Map<number, { userId: number; amount: number }[]>();
    for (const s of shareRows) {
      const list = sharesByExpense.get(s.expenseId) ?? [];
      list.push({ userId: s.userId, amount: s.amount });
      sharesByExpense.set(s.expenseId, list);
    }

    const full = expenseRows.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      paidBy: e.paidBy,
      createdBy: e.createdBy,
      createdAt: e.createdAt,
      category: e.category,
      editedAt: e.editedAt,
      shares: sharesByExpense.get(e.id) ?? [],
      // Presentation only; the DELETE and PATCH handlers enforce the same rules.
      canDelete: isAdmin || e.createdBy === me.id || e.paidBy === me.id,
      canEdit: canWrite && (isAdmin || e.createdBy === me.id),
    }));

    const balances = computeBalances(full, settlementRows);

    return {
      me: me.id,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        avatarUrl: m.avatarUrl,
      })),
      expenses: full,
      settlements: settlementRows.map((s) => ({
        ...s,
        canDelete: isAdmin || s.createdBy === me.id,
      })),
      balances: members.map((m) => ({ userId: m.id, net: balances.get(m.id) ?? 0 })),
      transfers: simplifyDebts(balances),
    };
  });
}

/** Add an expense. Validation lives in parseExpenseInput, shared with PATCH. */
export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user: me } = await tripRoute(ctx, "write");
    const input = await parseExpenseInput(await req.json().catch(() => null), {
      tripId: trip.id,
      me: me.id,
    });

    const shares = splitEqually(input.amount, input.sharedWith);

    const expense = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(expenses)
        .values({
          tripId: trip.id,
          description: input.description,
          amount: input.amount,
          paidBy: input.paidBy,
          category: input.category,
          createdBy: me.id,
        })
        .returning();
      await tx
        .insert(expenseShares)
        .values([...shares].map(([userId, share]) => ({ expenseId: created.id, userId, amount: share })));
      return created;
    });

    return { expense };
  });
}
