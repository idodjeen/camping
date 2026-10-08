import { and, asc, count, eq, inArray, max, ne, sql } from "drizzle-orm";

import { db, type Tx } from "@/db";
import {
  comments,
  gearCategories,
  gearItems,
  mealShoppingItems,
  meals,
  mealSlot,
  shoppingCategories,
  shoppingItems,
  trip,
  type Trip,
} from "@/db/schema";
import { SLOT_LABELS, addDays, daysUntil, formatTripDay, isDate } from "@/lib/dates";
import { readTripDetails, type TripDetails } from "@/lib/group-admin";
import { HttpError } from "@/lib/session";

/**
 * Groups phase 6: what a group admin edits inside a trip (/t/[tripId]/manage).
 * The trip's details, its gear and shopping categories, and its meals with
 * their ingredients. Every function assumes requireTrip(tripId, "admin").
 *
 * Every change starts by locking the trip's row, so two admins editing at the
 * same moment take turns: the "is this slot free?" and "is this name taken?"
 * checks below then hold until the change commits.
 */

/** Locks the trip's row and returns it as it is now, not as the request first saw it. */
async function lockTrip(tx: Tx, tripId: number): Promise<Trip> {
  const [row] = await tx.select().from(trip).where(eq(trip.id, tripId)).for("no key update");
  if (!row) throw new HttpError(404, "הטיול לא נמצא");
  return row;
}

/**
 * Meals display in `sort` order (see getMeals), which the seed filled in
 * chronologically. Renumbering by (date, slot) after every change keeps it so;
 * the enum sorts breakfast, lunch, dinner.
 */
async function renumberMeals(tx: Tx, tripId: number) {
  await tx.execute(sql`
    update ${meals} set sort = r.n
    from (select id, row_number() over (order by date, slot) - 1 as n from ${meals} where trip_id = ${tripId}) r
    where ${meals.id} = r.id
  `);
}

const mealLabel = (m: { date: string; slot: string }) => `${formatTripDay(m.date)} ${SLOT_LABELS[m.slot]}`;

/* --------------------------------------------------------------------- read */

export type ManageView = {
  trip: TripDetails & { id: number };
  gear: { id: number; name: string; items: number }[];
  shopping: { id: number; name: string; items: number }[];
  shoppingItems: { id: number; name: string; categoryId: number; quantityText: string | null }[];
  meals: {
    id: number;
    date: string;
    slot: (typeof mealSlot.enumValues)[number];
    title: string;
    description: string | null;
    itemIds: number[];
    comments: number;
  }[];
};

export async function manageView(t: Trip): Promise<ManageView> {
  const [gear, shopping, items, mealRows, links, commentCounts] = await Promise.all([
    db
      .select({ id: gearCategories.id, name: gearCategories.name, items: count(gearItems.id) })
      .from(gearCategories)
      .leftJoin(gearItems, eq(gearItems.categoryId, gearCategories.id))
      .where(eq(gearCategories.tripId, t.id))
      .groupBy(gearCategories.id)
      .orderBy(asc(gearCategories.sort), asc(gearCategories.id)),
    db
      .select({ id: shoppingCategories.id, name: shoppingCategories.name, items: count(shoppingItems.id) })
      .from(shoppingCategories)
      .leftJoin(shoppingItems, eq(shoppingItems.categoryId, shoppingCategories.id))
      .where(eq(shoppingCategories.tripId, t.id))
      .groupBy(shoppingCategories.id)
      .orderBy(asc(shoppingCategories.sort), asc(shoppingCategories.id)),
    db
      .select({
        id: shoppingItems.id,
        name: shoppingItems.name,
        categoryId: shoppingItems.categoryId,
        quantityText: shoppingItems.quantityText,
      })
      .from(shoppingItems)
      .where(eq(shoppingItems.tripId, t.id))
      .orderBy(asc(shoppingItems.sort), asc(shoppingItems.id)),
    db.select().from(meals).where(eq(meals.tripId, t.id)).orderBy(asc(meals.date), asc(meals.slot)),
    db.select().from(mealShoppingItems).where(eq(mealShoppingItems.tripId, t.id)),
    db
      .select({ mealId: comments.mealId, n: count() })
      .from(comments)
      .where(and(eq(comments.tripId, t.id), sql`${comments.mealId} is not null`))
      .groupBy(comments.mealId),
  ]);

  return {
    trip: {
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      locationName: t.locationName,
      lat: t.lat,
      lng: t.lng,
    },
    gear,
    shopping,
    shoppingItems: items,
    meals: mealRows.map((m) => ({
      id: m.id,
      date: m.date,
      slot: m.slot,
      title: m.title,
      description: m.description,
      itemIds: links.filter((l) => l.mealId === m.id).map((l) => l.shoppingItemId),
      comments: commentCounts.find((c) => c.mealId === m.id)?.n ?? 0,
    })),
  };
}

/* ------------------------------------------------------------- trip details */

export type TripEdit = TripDetails & {
  /** Move every meal by as many days as the start date moves. */
  shiftMeals: boolean;
};

export function parseTripEdit(raw: unknown): TripEdit {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const problems: string[] = [];
  const details = readTripDetails(body, problems);
  if (problems.length > 0) throw new HttpError(400, problems.join("\n"));
  return { ...details, shiftMeals: body.shiftMeals === true };
}

/**
 * Name, dates and location. Meals must stay inside the dates: moving the
 * start date can take them along, and anything that would still fall outside
 * is refused by name rather than dropped.
 */
export async function updateTripDetails(tripId: number, input: TripEdit) {
  return db.transaction(async (tx) => {
    const current = await lockTrip(tx, tripId);
    const shift = input.shiftMeals ? daysUntil(input.startDate, current.startDate) : 0;

    const rows = await tx.select({ date: meals.date, slot: meals.slot }).from(meals).where(eq(meals.tripId, tripId));
    const outside = rows
      .map((m) => ({ ...m, date: addDays(m.date, shift) }))
      .filter((m) => m.date < input.startDate || m.date > input.endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (outside.length > 0) {
      throw new HttpError(
        409,
        `יש ארוחות מחוץ לתאריכים החדשים: ${outside.map(mealLabel).join(", ")}. ` +
          (shift === 0 && input.startDate !== current.startDate
            ? "אפשר להזיז אותן יחד עם הטיול, או למחוק אותן קודם."
            : "אפשר למחוק או להזיז אותן קודם."),
      );
    }

    if (shift !== 0) {
      // (trip_id, date, slot) is unique and checked row by row, so moving
      // every meal by a day in one step would collide with its neighbour.
      // Park them far away first, then bring them to their new dates.
      const far = 100_000;
      await tx.update(meals).set({ date: sql`${meals.date} + ${far}::int` }).where(eq(meals.tripId, tripId));
      await tx
        .update(meals)
        .set({ date: sql`${meals.date} - ${far - shift}::int` })
        .where(eq(meals.tripId, tripId));
    }

    await tx
      .update(trip)
      .set({
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        locationName: input.locationName,
        lat: input.lat,
        lng: input.lng,
      })
      .where(eq(trip.id, tripId));
    return { shifted: shift !== 0 ? rows.length : 0 };
  });
}

/* --------------------------------------------------------------- categories */

export type ListKind = "gear" | "shopping";

const CATEGORY_MAX = 40;

const tables = {
  gear: { categories: gearCategories, items: gearItems },
  // Same columns under another name; one code path serves both lists.
  shopping: { categories: shoppingCategories, items: shoppingItems },
} as unknown as Record<ListKind, { categories: typeof gearCategories; items: typeof gearItems }>;

/** "gear" or "shopping" from the URL, or a 404. */
export function parseList(raw: string): ListKind {
  if (raw !== "gear" && raw !== "shopping") throw new HttpError(404, "אין רשימה כזו");
  return raw;
}

export function parseCategoryName(raw: unknown): string {
  const name = (raw && typeof raw === "object" ? (raw as Record<string, unknown>).name : null);
  const value = typeof name === "string" ? name.trim() : "";
  if (!value) throw new HttpError(400, "חסר שם לקטגוריה");
  if ([...value].length > CATEGORY_MAX) throw new HttpError(400, `שם הקטגוריה עד ${CATEGORY_MAX} תווים`);
  return value;
}

async function assertNameFree(tx: Tx, list: ListKind, tripId: number, name: string, except?: number) {
  const { categories } = tables[list];
  const [taken] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.tripId, tripId),
        sql`lower(${categories.name}) = lower(${name})`,
        except ? ne(categories.id, except) : undefined,
      ),
    );
  if (taken) throw new HttpError(409, `כבר יש קטגוריה בשם ${name}`);
}

/** A new category at the end of the list. */
export async function addCategory(tripId: number, list: ListKind, name: string) {
  const { categories } = tables[list];
  return db.transaction(async (tx) => {
    await lockTrip(tx, tripId);
    await assertNameFree(tx, list, tripId, name);
    const [{ last }] = await tx
      .select({ last: max(categories.sort) })
      .from(categories)
      .where(eq(categories.tripId, tripId));
    const [created] = await tx
      .insert(categories)
      .values({ tripId, name, sort: (last ?? -1) + 1 })
      .returning({ id: categories.id, name: categories.name });
    return { category: created };
  });
}

export async function renameCategory(tripId: number, list: ListKind, id: number, name: string) {
  const { categories } = tables[list];
  return db.transaction(async (tx) => {
    await lockTrip(tx, tripId);
    await assertNameFree(tx, list, tripId, name, id);
    const [row] = await tx
      .update(categories)
      .set({ name })
      .where(and(eq(categories.id, id), eq(categories.tripId, tripId)))
      .returning({ id: categories.id, name: categories.name });
    if (!row) throw new HttpError(404, "הקטגוריה לא נמצאה");
    return { category: row };
  });
}

/**
 * Only an empty category goes: deleting one with items would take their
 * claims, purchases and threads with it, which no admin means by "tidy up".
 */
export async function deleteCategory(tripId: number, list: ListKind, id: number) {
  const { categories, items } = tables[list];
  return db.transaction(async (tx) => {
    await lockTrip(tx, tripId);
    const [row] = await tx
      .select({ id: categories.id, items: count(items.id) })
      .from(categories)
      .leftJoin(items, eq(items.categoryId, categories.id))
      .where(and(eq(categories.id, id), eq(categories.tripId, tripId)))
      .groupBy(categories.id);
    if (!row) throw new HttpError(404, "הקטגוריה לא נמצאה");
    if (row.items > 0) {
      throw new HttpError(
        409,
        row.items === 1 ? "בקטגוריה יש פריט, ואפשר למחוק רק קטגוריה ריקה" : `בקטגוריה יש ${row.items} פריטים, ואפשר למחוק רק קטגוריה ריקה`,
      );
    }
    await tx.delete(categories).where(and(eq(categories.id, id), eq(categories.tripId, tripId)));
    return { deleted: true };
  });
}

export function parseOrder(raw: unknown): number[] {
  const ids = raw && typeof raw === "object" ? (raw as Record<string, unknown>).ids : null;
  if (!Array.isArray(ids) || !ids.every((n) => Number.isInteger(n) && n > 0)) {
    throw new HttpError(400, "סדר לא תקין");
  }
  return ids as number[];
}

/** The whole list in its new order; `ids` must be exactly the trip's categories. */
export async function reorderCategories(tripId: number, list: ListKind, ids: number[]) {
  const { categories } = tables[list];
  return db.transaction(async (tx) => {
    await lockTrip(tx, tripId);
    const current = (
      await tx.select({ id: categories.id }).from(categories).where(eq(categories.tripId, tripId))
    ).map((c) => c.id);
    const same = ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.includes(id));
    if (!same) throw new HttpError(409, "הרשימה השתנתה בינתיים, רעננו ונסו שוב");
    for (const [sort, id] of ids.entries()) {
      await tx.update(categories).set({ sort }).where(and(eq(categories.id, id), eq(categories.tripId, tripId)));
    }
    return { ids };
  });
}

/* -------------------------------------------------------------------- meals */

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 500;
const ITEM_NAME_MAX = 80;
const SLOTS = mealSlot.enumValues;

export type MealInput = {
  date: string;
  slot: (typeof SLOTS)[number];
  title: string;
  description: string | null;
  /** Shopping items of this trip that the meal needs. */
  itemIds: number[];
  /** Ingredients not on the shopping list yet: added to it, in this category. */
  newItems: { name: string; categoryId: number }[];
};

export function parseMeal(raw: unknown): MealInput {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const problems: string[] = [];

  const title = text(body.title);
  if (!title) problems.push("חסר שם לארוחה");
  else if ([...title].length > TITLE_MAX) problems.push(`שם הארוחה עד ${TITLE_MAX} תווים`);

  const description = text(body.description) || null;
  if (description && [...description].length > DESCRIPTION_MAX) problems.push(`התיאור עד ${DESCRIPTION_MAX} תווים`);

  const date = text(body.date);
  if (!isDate(date)) problems.push("תאריך לא תקין");
  const slot = body.slot as MealInput["slot"];
  if (!SLOTS.includes(slot)) problems.push("לא ברור איזו ארוחה");

  const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
  if (!itemIds.every((n) => Number.isInteger(n) && n > 0)) problems.push("רשימת המצרכים לא תקינה");

  const newItems: MealInput["newItems"] = [];
  for (const v of Array.isArray(body.newItems) ? body.newItems : []) {
    const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const name = text(p.name);
    const categoryId = Number(p.categoryId);
    if (!name) problems.push("חסר שם למצרך חדש");
    else if ([...name].length > ITEM_NAME_MAX) problems.push(`שם המצרך ${name} ארוך מדי`);
    else if (!Number.isInteger(categoryId) || categoryId <= 0) problems.push(`לא נבחרה קטגוריה ל${name}`);
    else newItems.push({ name, categoryId });
  }

  if (problems.length > 0) throw new HttpError(400, problems.join("\n"));
  return { date, slot, title, description, itemIds: [...new Set(itemIds as number[])], newItems };
}

/** The meal's place must be inside the trip and free (apart from the meal itself). */
async function assertSlotFree(tx: Tx, t: Trip, input: MealInput, except?: number) {
  if (input.date < t.startDate || input.date > t.endDate) {
    throw new HttpError(400, "התאריך מחוץ לתאריכי הטיול");
  }
  const [taken] = await tx
    .select({ title: meals.title })
    .from(meals)
    .where(
      and(
        eq(meals.tripId, t.id),
        eq(meals.date, input.date),
        eq(meals.slot, input.slot),
        except ? ne(meals.id, except) : undefined,
      ),
    );
  if (taken) throw new HttpError(409, `ב${mealLabel(input)} כבר יש ארוחה: ${taken.title}`);
}

/**
 * The shopping item ids the meal links to: the chosen ones (which must be
 * this trip's), plus the new ones, each either matched by name to an item
 * already on the list or added to it.
 */
async function resolveItems(tx: Tx, tripId: number, input: MealInput, by: number) {
  const ids = new Set<number>();
  if (input.itemIds.length > 0) {
    const found = await tx
      .select({ id: shoppingItems.id })
      .from(shoppingItems)
      .where(and(eq(shoppingItems.tripId, tripId), inArray(shoppingItems.id, input.itemIds)));
    if (found.length !== input.itemIds.length) throw new HttpError(400, "אחד המצרכים לא נמצא ברשימת הקניות");
    for (const f of found) ids.add(f.id);
  }

  for (const item of input.newItems) {
    const [existing] = await tx
      .select({ id: shoppingItems.id })
      .from(shoppingItems)
      .where(and(eq(shoppingItems.tripId, tripId), eq(shoppingItems.name, item.name)));
    if (existing) {
      ids.add(existing.id);
      continue;
    }
    const [category] = await tx
      .select({ id: shoppingCategories.id })
      .from(shoppingCategories)
      .where(and(eq(shoppingCategories.id, item.categoryId), eq(shoppingCategories.tripId, tripId)));
    if (!category) throw new HttpError(400, `הקטגוריה של ${item.name} לא נמצאה`);
    const [created] = await tx
      .insert(shoppingItems)
      .values({ tripId, categoryId: category.id, name: item.name, createdBy: by })
      .returning({ id: shoppingItems.id });
    ids.add(created.id);
  }
  return [...ids];
}

async function setLinks(tx: Tx, tripId: number, mealId: number, itemIds: number[]) {
  await tx.delete(mealShoppingItems).where(and(eq(mealShoppingItems.mealId, mealId), eq(mealShoppingItems.tripId, tripId)));
  if (itemIds.length > 0) {
    await tx.insert(mealShoppingItems).values(itemIds.map((shoppingItemId) => ({ tripId, mealId, shoppingItemId })));
  }
}

export async function createMeal(tripId: number, input: MealInput, by: number) {
  return db.transaction(async (tx) => {
    const t = await lockTrip(tx, tripId);
    await assertSlotFree(tx, t, input);
    const [created] = await tx
      .insert(meals)
      .values({ tripId: t.id, date: input.date, slot: input.slot, title: input.title, description: input.description })
      .returning({ id: meals.id });
    await setLinks(tx, t.id, created.id, await resolveItems(tx, t.id, input, by));
    await renumberMeals(tx, t.id);
    return { meal: created };
  });
}

/** Everything about a meal, its place included: its thread stays with it. */
export async function updateMeal(tripId: number, id: number, input: MealInput, by: number) {
  return db.transaction(async (tx) => {
    const t = await lockTrip(tx, tripId);
    const [row] = await tx.select({ id: meals.id }).from(meals).where(and(eq(meals.id, id), eq(meals.tripId, t.id)));
    if (!row) throw new HttpError(404, "הארוחה לא נמצאה");
    await assertSlotFree(tx, t, input, id);
    await tx
      .update(meals)
      .set({ date: input.date, slot: input.slot, title: input.title, description: input.description })
      .where(and(eq(meals.id, id), eq(meals.tripId, t.id)));
    await setLinks(tx, t.id, id, await resolveItems(tx, t.id, input, by));
    await renumberMeals(tx, t.id);
    return { meal: { id } };
  });
}

/**
 * The meal, its ingredient links and its thread (both cascade). The shopping
 * items themselves stay: other meals may need them, and they may be bought.
 */
export async function deleteMeal(tripId: number, id: number) {
  const [row] = await db
    .delete(meals)
    .where(and(eq(meals.id, id), eq(meals.tripId, tripId)))
    .returning({ id: meals.id });
  if (!row) throw new HttpError(404, "הארוחה לא נמצאה");
  return { deleted: true };
}
