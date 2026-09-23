import { asc, count, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { comments, gearCategories, meals, shoppingCategories } from "@/db/schema";

/**
 * Read models shared by the route handlers.
 *
 * These use Drizzle's relational query API so each page is a single round trip
 * rather than an N+1 walk over categories -> items -> claims. On Neon, where
 * every query crosses the network, that difference is the page feeling instant
 * versus visibly filling in.
 */

export type ClaimView = {
  userId: number;
  name: string;
  slug: string;
  avatarUrl: string | null;
  qty: number;
  isPacked: boolean;
};

/**
 * Comment counts per item, fetched as one grouped query per list rather than
 * a count per row — 45 gear items would otherwise be 45 extra round trips to
 * Neon just to render a number on each row.
 */
type SubjectColumn =
  | typeof comments.gearItemId
  | typeof comments.shoppingItemId
  | typeof comments.mealId;

async function commentCounts(column: SubjectColumn) {
  const rows = await db
    .select({ id: column, n: count() })
    .from(comments)
    .where(isNotNull(column))
    .groupBy(column);
  return new Map(rows.map((r) => [r.id as number, r.n]));
}

export type GearItemView = {
  id: number;
  name: string;
  qtyNeeded: number | null;
  qtyLabel: string | null;
  isOptional: boolean;
  isOpenQuantity: boolean;
  notes: string | null;
  claims: ClaimView[];
  claimedTotal: number;
  remaining: number | null;
  isFull: boolean;
  commentCount: number;
};

export async function getGear() {
  const counts = await commentCounts(comments.gearItemId);
  const rows = await db.query.gearCategories.findMany({
    orderBy: [asc(gearCategories.sort)],
    with: {
      items: {
        with: { claims: { with: { user: true } } },
      },
    },
  });

  return rows.map((cat) => ({
    id: cat.id,
    name: cat.name,
    items: cat.items
      .map((item): GearItemView => {
        const claimedTotal = item.claims.reduce((n, c) => n + c.qty, 0);
        // Open-quantity items ("הרבה", "כמה שיותר") have no target, so they are
        // "covered" as soon as one person takes them but never show a remainder.
        const isFull = item.isOpenQuantity
          ? item.claims.length > 0
          : claimedTotal >= (item.qtyNeeded ?? 1);

        return {
          id: item.id,
          name: item.name,
          qtyNeeded: item.qtyNeeded,
          qtyLabel: item.qtyLabel,
          isOptional: item.isOptional,
          isOpenQuantity: item.isOpenQuantity,
          notes: item.notes,
          claims: item.claims.map((c) => ({
            userId: c.userId,
            name: c.user?.name ?? "",
            slug: c.user?.slug ?? "",
            avatarUrl: c.user?.avatarUrl ?? null,
            qty: c.qty,
            isPacked: c.isPacked,
          })),
          claimedTotal,
          commentCount: counts.get(item.id) ?? 0,
          remaining: item.isOpenQuantity
            ? null
            : Math.max((item.qtyNeeded ?? 1) - claimedTotal, 0),
          isFull,
        };
      })
      .sort((a, b) => a.id - b.id),
  }));
}

export async function getShopping() {
  const counts = await commentCounts(comments.shoppingItemId);
  const rows = await db.query.shoppingCategories.findMany({
    orderBy: [asc(shoppingCategories.sort)],
    with: {
      items: {
        with: { buyer: true, mealLinks: { with: { meal: true } } },
      },
    },
  });

  return rows.map((cat) => ({
    id: cat.id,
    name: cat.name,
    items: cat.items
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantityText: item.quantityText,
        notes: item.notes,
        isBought: item.isBought,
        boughtBy: item.buyer
          ? { name: item.buyer.name, slug: item.buyer.slug, avatarUrl: item.buyer.avatarUrl }
          : null,
        boughtAt: item.boughtAt,
        commentCount: counts.get(item.id) ?? 0,
        meals: item.mealLinks.map((l) => ({
          id: l.meal.id,
          title: l.meal.title,
          date: l.meal.date,
          slot: l.meal.slot,
        })),
      }))
      .sort((a, b) => a.id - b.id),
  }));
}

export type MealView = {
  id: number;
  slot: "breakfast" | "lunch" | "dinner";
  title: string;
  description: string | null;
  items: { id: number; name: string; quantityText: string | null; isBought: boolean }[];
  commentCount: number;
};

export async function getMeals(): Promise<{ date: string; meals: MealView[] }[]> {
  const counts = await commentCounts(comments.mealId);
  const rows = await db.query.meals.findMany({
    orderBy: [asc(meals.sort)],
    with: { shoppingLinks: { with: { shoppingItem: true } } },
  });

  // Grouped into days here so the timeline renders directly. `meals.sort` is
  // seeded in chronological order, so day order and slot order both follow.
  const days: { date: string; meals: MealView[] }[] = [];
  for (const m of rows) {
    let day = days.find((d) => d.date === m.date);
    if (!day) {
      day = { date: m.date, meals: [] };
      days.push(day);
    }
    day.meals.push({
      id: m.id,
      slot: m.slot,
      title: m.title,
      description: m.description,
      commentCount: counts.get(m.id) ?? 0,
      items: m.shoppingLinks.map((l) => ({
        id: l.shoppingItem.id,
        name: l.shoppingItem.name,
        quantityText: l.shoppingItem.quantityText,
        isBought: l.shoppingItem.isBought,
      })),
    });
  }
  return days;
}
