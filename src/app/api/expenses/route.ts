import { desc, inArray } from "drizzle-orm";

import { db } from "@/db";
import { expenseShares, expenses, settlements, users } from "@/db/schema";
import { computeBalances, simplifyDebts, splitEqually } from "@/lib/expenses";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_AMOUNT = 10_000_000; // ₪100,000 — a typo guard, not a real limit

export function GET() {
  return handle(async () => {
    const me = await requireUser();

    const [members, expenseRows, shareRows, settlementRows] = await Promise.all([
      db.select().from(users).orderBy(users.id),
      db.select().from(expenses).orderBy(desc(expenses.createdAt), desc(expenses.id)),
      db.select().from(expenseShares),
      db.select().from(settlements).orderBy(desc(settlements.createdAt), desc(settlements.id)),
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
      canDelete: me.isAdmin || e.createdBy === me.id || e.paidBy === me.id,
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
        canDelete: me.isAdmin || s.createdBy === me.id,
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
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
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
    // Validate against real users rather than trusting ids from the request.
    const ids = [...new Set([paidBy, ...sharedWith])];
    const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
    if (found.length !== ids.length) throw new HttpError(400, "אחד המשתתפים לא נמצא");

    const shares = splitEqually(amount!, sharedWith);

    const expense = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(expenses)
        .values({ description, amount: amount!, paidBy, createdBy: me.id })
        .returning();
      await tx
        .insert(expenseShares)
        .values([...shares].map(([userId, share]) => ({ expenseId: created.id, userId, amount: share })));
      return created;
    });

    return { expense };
  });
}
