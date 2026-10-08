import { asc, eq } from "drizzle-orm";

import type { Tx } from "@/db";
import {
  gearCategories,
  gearItems,
  mealShoppingItems,
  meals,
  shoppingCategories,
  shoppingItems,
} from "@/db/schema";
import { GEAR, SHOPPING } from "@/db/seed-data";
import { addDays, daysUntil } from "@/lib/dates";

/**
 * What a new trip starts with: the template, or a copy of an earlier trip in
 * the same group. Both run inside createTrip()'s transaction, right after the
 * trip row is inserted.
 *
 * Children are matched to their new parents by name (category names and
 * shopping item names are unique per trip), not by the order rows come back.
 */

/**
 * The gear and shopping lists from src/db/seed-data.ts: names, quantities and
 * gear notes. No shopping notes, since those are the founders' own
 * arrangements ("עידודו"), and no meals.
 */
export async function fillFromTemplate(tx: Tx, tripId: number) {
  const gearCats = await tx
    .insert(gearCategories)
    .values(GEAR.map((c, sort) => ({ tripId, name: c.name, sort })))
    .returning({ id: gearCategories.id, name: gearCategories.name });
  const gearCat = new Map(gearCats.map((c) => [c.name, c.id]));
  await tx.insert(gearItems).values(
    GEAR.flatMap((c) =>
      c.items.map((item) => ({
        tripId,
        categoryId: gearCat.get(c.name)!,
        name: item.name,
        qtyNeeded: item.qtyNeeded,
        qtyLabel: item.qtyLabel ?? null,
        isOptional: item.isOptional ?? false,
        isOpenQuantity: item.isOpenQuantity ?? false,
        notes: item.notes ?? null,
      })),
    ),
  );

  const shopCats = await tx
    .insert(shoppingCategories)
    .values(SHOPPING.map((c, sort) => ({ tripId, name: c.name, sort })))
    .returning({ id: shoppingCategories.id, name: shoppingCategories.name });
  const shopCat = new Map(shopCats.map((c) => [c.name, c.id]));
  await tx.insert(shoppingItems).values(
    SHOPPING.flatMap((c) =>
      c.items.map((item, sort) => ({
        tripId,
        categoryId: shopCat.get(c.name)!,
        name: item.name,
        quantityText: item.quantityText ?? null,
        sort,
      })),
    ),
  );
}

/**
 * An earlier trip's lists and meals. Gear and shopping come over as they were
 * written, but with nobody's claims, nothing bought, and `created_by` empty so
 * nobody gets leaderboard credit twice. Meals move by the gap between the two
 * start dates; any that land outside the new dates are left behind. Their
 * ingredient links are remapped by shopping item name.
 */
export async function fillFromTrip(
  tx: Tx,
  tripId: number,
  from: { id: number; startDate: string },
  dates: { startDate: string; endDate: string },
) {
  /* ------------------------------------------------------------------ gear */
  const oldGearCats = await tx
    .select()
    .from(gearCategories)
    .where(eq(gearCategories.tripId, from.id))
    .orderBy(asc(gearCategories.sort), asc(gearCategories.id));
  if (oldGearCats.length > 0) {
    const created = await tx
      .insert(gearCategories)
      .values(oldGearCats.map((c) => ({ tripId, name: c.name, sort: c.sort })))
      .returning({ id: gearCategories.id, name: gearCategories.name });
    const byName = new Map(created.map((c) => [c.name, c.id]));
    const newCat = new Map(oldGearCats.map((c) => [c.id, byName.get(c.name)!]));

    const items = await tx
      .select()
      .from(gearItems)
      .where(eq(gearItems.tripId, from.id))
      .orderBy(asc(gearItems.id));
    if (items.length > 0) {
      await tx.insert(gearItems).values(
        items.map((item) => ({
          tripId,
          categoryId: newCat.get(item.categoryId)!,
          name: item.name,
          qtyNeeded: item.qtyNeeded,
          qtyLabel: item.qtyLabel,
          isOptional: item.isOptional,
          isOpenQuantity: item.isOpenQuantity,
          notes: item.notes,
        })),
      );
    }
  }

  /* -------------------------------------------------------------- shopping */
  const newItem = new Map<string, number>();
  const oldShopCats = await tx
    .select()
    .from(shoppingCategories)
    .where(eq(shoppingCategories.tripId, from.id))
    .orderBy(asc(shoppingCategories.sort), asc(shoppingCategories.id));
  if (oldShopCats.length > 0) {
    const created = await tx
      .insert(shoppingCategories)
      .values(oldShopCats.map((c) => ({ tripId, name: c.name, sort: c.sort })))
      .returning({ id: shoppingCategories.id, name: shoppingCategories.name });
    const byName = new Map(created.map((c) => [c.name, c.id]));
    const newCat = new Map(oldShopCats.map((c) => [c.id, byName.get(c.name)!]));

    const items = await tx
      .select()
      .from(shoppingItems)
      .where(eq(shoppingItems.tripId, from.id))
      .orderBy(asc(shoppingItems.sort), asc(shoppingItems.id));
    if (items.length > 0) {
      const inserted = await tx
        .insert(shoppingItems)
        .values(
          items.map((item) => ({
            tripId,
            categoryId: newCat.get(item.categoryId)!,
            name: item.name,
            quantityText: item.quantityText,
            notes: item.notes,
            sort: item.sort,
          })),
        )
        .returning({ id: shoppingItems.id, name: shoppingItems.name });
      for (const row of inserted) newItem.set(row.name, row.id);
    }
  }

  /* ----------------------------------------------------------------- meals */
  const shift = daysUntil(dates.startDate, from.startDate);
  const kept = (
    await tx.select().from(meals).where(eq(meals.tripId, from.id)).orderBy(asc(meals.sort), asc(meals.id))
  )
    .map((m) => ({ ...m, date: addDays(m.date, shift) }))
    .filter((m) => m.date >= dates.startDate && m.date <= dates.endDate);
  if (kept.length === 0) return;

  const created = await tx
    .insert(meals)
    .values(
      kept.map((m) => ({
        tripId,
        date: m.date,
        slot: m.slot,
        title: m.title,
        description: m.description,
        sort: m.sort,
      })),
    )
    .returning({ id: meals.id, date: meals.date, slot: meals.slot });
  // (date, slot) is unique per trip, and the shift keeps it so.
  const bySlot = new Map(created.map((m) => [`${m.date} ${m.slot}`, m.id]));
  const newMeal = new Map(kept.map((m) => [m.id, bySlot.get(`${m.date} ${m.slot}`)!]));

  const links = await tx
    .select({ mealId: mealShoppingItems.mealId, name: shoppingItems.name })
    .from(mealShoppingItems)
    .innerJoin(shoppingItems, eq(shoppingItems.id, mealShoppingItems.shoppingItemId))
    .where(eq(mealShoppingItems.tripId, from.id));
  const values = links.flatMap((l) => {
    const mealId = newMeal.get(l.mealId);
    const shoppingItemId = newItem.get(l.name);
    return mealId && shoppingItemId ? [{ tripId, mealId, shoppingItemId }] : [];
  });
  if (values.length > 0) await tx.insert(mealShoppingItems).values(values);
}
