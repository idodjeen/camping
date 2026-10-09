import { and, asc, count, eq, isNotNull, isNull, sql, type SQLWrapper } from "drizzle-orm";

import { db } from "@/db";
import {
  comments,
  gearCategories,
  gearClaims,
  gearItems,
  meals,
  notifications,
  shoppingCategories,
  shoppingItems,
} from "@/db/schema";
import { SLOT_HOUR } from "@/lib/dates";

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

async function commentCounts(tripId: number, column: SubjectColumn) {
  const rows = await db
    .select({ id: column, n: count() })
    .from(comments)
    .where(and(eq(comments.tripId, tripId), isNotNull(column)))
    .groupBy(column);
  return new Map(rows.map((r) => [r.id as number, r.n]));
}

/**
 * How many messages tagged *me* on each item and are still unread.
 *
 * Without this the bottom-nav badge is a dead end: it says "2 waiting in gear"
 * and then 49 rows look identical. Grouped in one query per list, exactly like
 * commentCounts — the per-row alternative is 49 round trips to Neon.
 *
 * viewerId is optional because the email jobs call these read models with no
 * one looking; an absent viewer simply has nothing unread.
 */
async function unreadCounts(tripId: number, column: SubjectColumn, viewerId?: number) {
  if (viewerId === undefined) return new Map<number, number>();

  // Tag rows always exist, whatever the bell's switches say, so the marker
  // shows even with tag notifications off.
  const rows = await db
    .select({ id: column, n: count() })
    .from(notifications)
    .innerJoin(
      comments,
      and(eq(comments.tripId, notifications.tripId), eq(comments.id, notifications.commentId)),
    )
    .where(
      and(
        eq(notifications.tripId, tripId),
        eq(notifications.userId, viewerId),
        eq(notifications.kind, "mention"),
        isNull(notifications.readAt),
        isNotNull(column),
      ),
    )
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
  /** Mine only — how many unread tags this item's thread is holding for me. */
  unreadMentions: number;
};

/**
 * Whether claims cover an item, and what is left. Open-quantity items ("הרבה",
 * "כמה שיותר") have no target, so they are "covered" as soon as one person
 * takes them but never show a remainder.
 */
function coverage(
  item: { isOpenQuantity: boolean; qtyNeeded: number | null },
  claimedTotal: number,
  claimCount: number,
) {
  return {
    isFull: item.isOpenQuantity ? claimCount > 0 : claimedTotal >= (item.qtyNeeded ?? 1),
    remaining: item.isOpenQuantity ? null : Math.max((item.qtyNeeded ?? 1) - claimedTotal, 0),
  };
}

export async function getGear(tripId: number, viewerId?: number) {
  // Three independent reads, so one round trip.
  const [counts, unread, rows] = await Promise.all([
    commentCounts(tripId, comments.gearItemId),
    unreadCounts(tripId, comments.gearItemId, viewerId),
    // Items hang off their category, and a composite FK keeps both in one trip,
    // so filtering the categories is enough to scope the whole tree.
    db.query.gearCategories.findMany({
      where: eq(gearCategories.tripId, tripId),
      orderBy: [asc(gearCategories.sort)],
      with: {
        items: {
          with: { claims: { with: { user: true } } },
        },
      },
    }),
  ]);

  return rows.map((cat) => ({
    id: cat.id,
    name: cat.name,
    items: cat.items
      .map((item): GearItemView => {
        const claimedTotal = item.claims.reduce((n, c) => n + c.qty, 0);
        const { isFull, remaining } = coverage(item, claimedTotal, item.claims.length);

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
          unreadMentions: unread.get(item.id) ?? 0,
          remaining,
          isFull,
        };
      })
      .sort((a, b) => a.id - b.id),
  }));
}

export async function getShopping(tripId: number, viewerId?: number) {
  const [counts, unread, rows] = await Promise.all([
    commentCounts(tripId, comments.shoppingItemId),
    unreadCounts(tripId, comments.shoppingItemId, viewerId),
    db.query.shoppingCategories.findMany({
      where: eq(shoppingCategories.tripId, tripId),
      orderBy: [asc(shoppingCategories.sort)],
      with: {
        items: {
          with: { buyer: true, mealLinks: { with: { meal: true } } },
        },
      },
    }),
  ]);

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
        unreadMentions: unread.get(item.id) ?? 0,
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
  unreadMentions: number;
};

export async function getMeals(
  tripId: number,
  viewerId?: number,
): Promise<{ date: string; meals: MealView[] }[]> {
  const [counts, unread, rows] = await Promise.all([
    commentCounts(tripId, comments.mealId),
    unreadCounts(tripId, comments.mealId, viewerId),
    db.query.meals.findMany({
      where: eq(meals.tripId, tripId),
      orderBy: [asc(meals.sort)],
      with: { shoppingLinks: { with: { shoppingItem: true } } },
    }),
  ]);

  // Grouped into days here so the timeline renders directly. `meals.sort` is
  // seeded in chronological order, so day order and slot order both follow.
  const days: { date: string; meals: MealView[] }[] = [];
  for (const m of rows) {
    let day = days.find((d) => d.date === m.date);
    if (!day) {
      day = { date: m.date, meals: [] };
      days.push(day);
    }
    day.meals.push(mealView(m, counts.get(m.id) ?? 0, unread.get(m.id) ?? 0));
  }
  return days;
}

type MealRow = typeof meals.$inferSelect & {
  shoppingLinks: { shoppingItem: { id: number; name: string; quantityText: string | null; isBought: boolean } }[];
};

function mealView(m: MealRow, commentCount: number, unreadMentions: number): MealView {
  return {
    id: m.id,
    slot: m.slot,
    title: m.title,
    description: m.description,
    commentCount,
    unreadMentions,
    items: m.shoppingLinks.map((l) => ({
      id: l.shoppingItem.id,
      name: l.shoppingItem.name,
      quantityText: l.shoppingItem.quantityText,
      isBought: l.shoppingItem.isBought,
    })),
  };
}

/* -------------------------------------------------------------- dashboard */

/**
 * The dashboard's numbers, counted in SQL rather than by loading the three
 * lists with every claim, buyer, link and comment count: three small reads,
 * together, so one round trip.
 *
 * Optional items are excluded from the gear ring: it shows how close the trip
 * is to being *equipped*, and משחקי קופסה never blocks that.
 */
export async function getDashboard(tripId: number, now: string) {
  const [gear, [shopping], next] = await Promise.all([
    db
      .select({
        id: gearItems.id,
        name: gearItems.name,
        qtyLabel: gearItems.qtyLabel,
        qtyNeeded: gearItems.qtyNeeded,
        isOpenQuantity: gearItems.isOpenQuantity,
        categoryName: gearCategories.name,
        claimedTotal: sql<number>`coalesce(sum(${gearClaims.qty}), 0)::int`,
        claimCount: sql<number>`count(${gearClaims.id})::int`,
      })
      .from(gearItems)
      .innerJoin(gearCategories, eq(gearCategories.id, gearItems.categoryId))
      .leftJoin(gearClaims, eq(gearClaims.gearItemId, gearItems.id))
      .where(and(eq(gearItems.tripId, tripId), eq(gearItems.isOptional, false)))
      .groupBy(gearItems.id, gearCategories.id)
      // getGear's order: categories by sort, items by id.
      .orderBy(asc(gearCategories.sort), asc(gearCategories.id), asc(gearItems.id)),
    db
      .select({
        done: sql<number>`(count(*) filter (where ${shoppingItems.isBought}))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(shoppingItems)
      .where(eq(shoppingItems.tripId, tripId)),
    // `sort` is renumbered by (date, slot) after every change (trip-content.ts),
    // so the first meal by sort that hasn't started is the next one.
    db.query.meals.findFirst({
      where: (m) => and(eq(m.tripId, tripId), sql`${m.date}::text || 'T' || ${slotHour(m.slot)} >= ${now}`),
      orderBy: (m) => [asc(m.sort)],
      with: { shoppingLinks: { with: { shoppingItem: true } } },
      // Spelled out with an alias: inside `extras`, Drizzle qualifies every
      // column with the meals alias, `comments.trip_id` included.
      extras: (m) => ({
        commentCount: sql<number>`(select count(*)::int from ${comments} as c where c.trip_id = ${m.tripId} and c.meal_id = ${m.id})`.as(
          "comment_count",
        ),
      }),
    }),
  ]);

  const required = gear.map((i) => ({ ...i, ...coverage(i, i.claimedTotal, i.claimCount) }));
  return {
    progress: {
      gear: { done: required.filter((i) => i.isFull).length, total: required.length },
      shopping: { done: shopping?.done ?? 0, total: shopping?.total ?? 0 },
    },
    // The dashboard has no viewer, so nothing on it is unread.
    nextMeal: next ? { ...mealView(next, next.commentCount, 0), date: next.date } : null,
    unclaimed: required
      .filter((i) => !i.isFull)
      .map((i) => ({
        id: i.id,
        name: i.name,
        qtyLabel: i.qtyLabel,
        remaining: i.remaining,
        categoryName: i.categoryName,
      })),
  };
}

/** SLOT_HOUR as SQL, so the database compares a meal with the clock the same way. */
const slotHour = (slot: SQLWrapper) =>
  sql`(case ${slot} ${sql.join(
    Object.entries(SLOT_HOUR).map(([s, hour]) => sql`when ${s} then ${hour}`),
    sql` `,
  )} end)`;
