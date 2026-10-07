/**
 * Pure money logic for the expenses screen. No DB and no React, so it is safe
 * to import from both route handlers and client components.
 *
 * All amounts are integer agorot (1/100 ₪).
 */

/** Splits `total` equally; the leftover agorot go one each to the first people. */
export function splitEqually(total: number, userIds: number[]): Map<number, number> {
  const ids = [...new Set(userIds)].sort((a, b) => a - b);
  const base = Math.floor(total / ids.length);
  const extra = total - base * ids.length;
  return new Map(ids.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
}

export type Balances = Map<number, number>;

/**
 * Net position per person: positive = the group owes them, negative = they owe.
 * The values always sum to zero.
 */
export function computeBalances(
  expenses: { paidBy: number; amount: number; shares: { userId: number; amount: number }[] }[],
  settlements: { fromUser: number; toUser: number; amount: number }[],
): Balances {
  const net: Balances = new Map();
  const add = (id: number, delta: number) => net.set(id, (net.get(id) ?? 0) + delta);

  for (const e of expenses) {
    add(e.paidBy, e.amount);
    for (const s of e.shares) add(s.userId, -s.amount);
  }
  // Paying someone back moves the payer toward zero and the receiver toward zero.
  for (const s of settlements) {
    add(s.fromUser, s.amount);
    add(s.toUser, -s.amount);
  }
  return net;
}

export type Transfer = { from: number; to: number; amount: number };

/**
 * Turns balances into the fewest payments that clear everyone: repeatedly match
 * the biggest debtor with the biggest creditor. Not always the theoretical
 * minimum (that is NP-hard) but at most n-1 payments, and ideal for a group of five.
 */
export function simplifyDebts(balances: Balances): Transfer[] {
  const debtors = [...balances].filter(([, v]) => v < 0).map(([id, v]) => ({ id, left: -v }));
  const creditors = [...balances].filter(([, v]) => v > 0).map(([id, v]) => ({ id, left: v }));
  const transfers: Transfer[] = [];

  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.left - a.left || a.id - b.id);
    creditors.sort((a, b) => b.left - a.left || a.id - b.id);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.left, c.left);
    transfers.push({ from: d.id, to: c.id, amount });
    d.left -= amount;
    c.left -= amount;
    if (d.left === 0) debtors.shift();
    if (c.left === 0) creditors.shift();
  }
  return transfers;
}

/** "45", "45.5", "45,50" -> agorot, or null when it is not a positive amount. */
export function parseAmount(input: string): number | null {
  const m = input.trim().replace(",", ".").match(/^(\d{1,7})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const agorot = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
  return agorot > 0 ? agorot : null;
}

export function formatMoney(agorot: number): string {
  const shekels = agorot / 100;
  return `₪${Number.isInteger(shekels) ? shekels : shekels.toFixed(2)}`;
}

/** agorot -> what the amount field shows: "45", "45.50". The inverse of parseAmount. */
export function amountToInput(agorot: number): string {
  return agorot % 100 === 0 ? String(agorot / 100) : (agorot / 100).toFixed(2);
}

/**
 * Stored as text and checked by the API, not the database, so this list can
 * change without a migration. The order is the chip order in the form and the
 * color slot in the chart.
 */
export const EXPENSE_CATEGORIES = [
  { key: "food", label: "אוכל ושתייה" },
  { key: "fuel", label: "דלק ונסיעות" },
  { key: "lodging", label: "לינה" },
  { key: "gear", label: "ציוד" },
  { key: "activities", label: "פעילויות" },
  { key: "other", label: "אחר" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["key"];

export function isCategory(value: unknown): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.some((c) => c.key === value);
}

/** A stored value read back: anything this build doesn't know shows as "other". */
export function categoryOf(value: string): ExpenseCategory {
  return isCategory(value) ? value : "other";
}

export function categoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === categoryOf(value))!.label;
}
