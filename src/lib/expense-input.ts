import { isCategory, type ExpenseCategory } from "@/lib/expenses";
import { HttpError } from "@/lib/session";
import { tripPeople } from "@/lib/trips";

const MAX_AMOUNT = 10_000_000; // ₪100,000 - a typo guard, not a real limit

export type ExpenseInput = {
  description: string;
  amount: number;
  paidBy: number;
  sharedWith: number[];
  category: ExpenseCategory;
};

/**
 * The one validator behind POST and PATCH, so an edit can't save what adding
 * would refuse. `amount` is integer agorot; the client parses "45.50" so the
 * server never has to guess at locale-specific decimal separators.
 *
 * Creating: every field is checked, and missing ones get their defaults (the
 * caller pays, category "other"). Editing (`partial`): only the fields sent
 * are checked and returned, so fixing a description never trips over a payer
 * who has since left the trip.
 */
export async function parseExpenseInput(
  raw: unknown,
  { tripId, me, partial }: { tripId: number; me: number; partial: true },
): Promise<Partial<ExpenseInput>>;
export async function parseExpenseInput(
  raw: unknown,
  { tripId, me, partial }: { tripId: number; me: number; partial?: false },
): Promise<ExpenseInput>;
export async function parseExpenseInput(
  raw: unknown,
  { tripId, me, partial = false }: { tripId: number; me: number; partial?: boolean },
): Promise<Partial<ExpenseInput>> {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const has = (key: string) => !partial || body[key] !== undefined;
  const out: Partial<ExpenseInput> = {};

  if (has("description")) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!description) throw new HttpError(400, "צריך לתאר את ההוצאה");
    if (description.length > 100) throw new HttpError(400, "התיאור ארוך מדי");
    out.description = description;
  }

  if (has("amount")) {
    const amount = body.amount;
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
      throw new HttpError(400, "סכום לא תקין");
    }
    out.amount = amount;
  }

  if (has("sharedWith")) {
    const list = Array.isArray(body.sharedWith) ? body.sharedWith : [];
    const sharedWith = [...new Set(list)];
    if (sharedWith.length === 0) throw new HttpError(400, "צריך לבחור עם מי לחלק");
    if (!sharedWith.every((id) => Number.isInteger(id))) throw new HttpError(400, "אחד המשתתפים לא נמצא");
    out.sharedWith = sharedWith as number[];
  }

  if (has("paidBy")) {
    const paidBy = body.paidBy ?? (partial ? undefined : me);
    if (!Number.isInteger(paidBy)) throw new HttpError(400, "אחד המשתתפים לא נמצא");
    out.paidBy = paidBy as number;
  }

  if (has("category")) {
    const category = body.category ?? (partial ? undefined : "other");
    if (!isCategory(category)) throw new HttpError(400, "קטגוריה לא מוכרת");
    out.category = category;
  }

  // Everyone named must be on this trip; ids from the request are never trusted.
  const named = [...(out.paidBy === undefined ? [] : [out.paidBy]), ...(out.sharedWith ?? [])];
  if (named.length > 0) {
    const onTrip = new Set((await tripPeople(tripId)).map((p) => p.id));
    if (!named.every((id) => onTrip.has(id))) throw new HttpError(400, "אחד המשתתפים לא נמצא");
  }

  if (partial && Object.keys(out).length === 0) throw new HttpError(400, "אין מה לעדכן");
  return out;
}
