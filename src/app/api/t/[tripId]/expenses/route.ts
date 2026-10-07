import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { expenseShares, expenses, settlements } from "@/db/schema";
import { tripRoute, type TripParams } from "@/lib/access";
import { computeBalances, simplifyDebts, splitEqually } from "@/lib/expenses";
import { handle, HttpError } from "@/lib/session";
import { tripPeople } from "@/lib/trips";

export const dynamic = "force-dynamic";

const MAX_AMOUNT = 10_000_000; // ₪100,000 - a typo guard, not a real limit

export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user: me, isAdmin } = await tripRoute(ctx);

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
      shares: sharesByExpense.get(e.id) ?? [],
      // Presentation only; the DELETE handler enforces the same rule.
      canDelete: isAdmin || e.createdBy === me.id || e.paidBy === me.id,
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

/**
 * Add an expense. `amount` is integer agorot; the client parses "45.50" so the
 * server never has to guess at locale-specific decimal separators.
 */
export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user: me } = await tripRoute(ctx, "write");
    const body = (await req.json()) as {
      description?: string;
      amount?: number;
      paidBy?: number;
      sharedWith?: number[];
    };

    const description = body.description?.trim();
    if (!description) throw new HttpError(400, "צריך לתאר את ההוצאה");
    if (description.length > 100) throw new HttpError(400, "התיאור ארוך מדי");

    const amount = body.amount;
    if (!Number.isInteger(amount) || amount! < 1 || amount! > MAX_AMOUNT) {
      throw new HttpError(400, "סכום לא תקין");
    }

    const sharedWith = [...new Set(body.sharedWith ?? [])];
    if (sharedWith.length === 0) throw new HttpError(400, "צריך לבחור עם מי לחלק");

    const paidBy = body.paidBy ?? me.id;
    // Everyone named must be on this trip; ids from the request are never trusted.
    const onTrip = new Set((await tripPeople(trip.id)).map((p) => p.id));
    if (![paidBy, ...sharedWith].every((id) => onTrip.has(id))) {
      throw new HttpError(400, "אחד המשתתפים לא נמצא");
    }

    const shares = splitEqually(amount!, sharedWith);

    const expense = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(expenses)
        .values({ tripId: trip.id, description, amount: amount!, paidBy, createdBy: me.id })
        .returning();
      await tx
        .insert(expenseShares)
        .values([...shares].map(([userId, share]) => ({ expenseId: created.id, userId, amount: share })));
      return created;
    });

    return { expense };
  });
}
