/**
 * Idempotent seed for מחנאות 2026.
 *
 *   npm run db:seed     -- safe to re-run; never touches claims or purchases
 *   npm run db:reset    -- hard wipe, then reseed
 *
 * Re-running updates seeded *content* (names, quantities, meal links) while
 * deliberately preserving *state* the group has created: gear claims, packed
 * flags, personal lists, who bought what, and onboarding progress.
 */
import { config } from "dotenv";

// Must run before the db module is imported — it reads DATABASE_URL at import
// time, and ESM hoists static imports above this call. Hence the dynamic
// import of ./index further down.
config({ path: ".env.local" });
config({ path: ".env" });

import { sql } from "drizzle-orm";

import { parseAllowlist } from "../lib/allowlist.js";
import { GEAR, MEALS, ROSTER, SHOPPING, TRIP } from "./seed-data.js";

const RESET = process.argv.includes("--reset");

async function main() {
  const { db } = await import("./index.js");
  const s = await import("./schema.js");

  if (RESET) {
    console.warn("⚠️  --reset: wiping ALL tables, including claims and purchases.");
    await db.execute(sql`
      TRUNCATE TABLE
        ${s.mealShoppingItems}, ${s.meals}, ${s.shoppingItems}, ${s.shoppingCategories},
        ${s.gearClaims}, ${s.gearItems}, ${s.gearCategories},
        ${s.personalItems}, ${s.users}, ${s.trip}
      RESTART IDENTITY CASCADE
    `);
  }

  await db.transaction(async (tx) => {
    /* ---------------------------------------------------------------- trip */
    await tx
      .insert(s.trip)
      .values({ id: 1, ...TRIP })
      .onConflictDoUpdate({ target: s.trip.id, set: { ...TRIP } });

    /* --------------------------------------------------------------- users */
    const allowed = parseAllowlist();
    if (allowed.length === 0) {
      console.warn(
        "⚠️  ALLOWED_USERS is empty — no users seeded. Set it and re-run `npm run db:seed`.",
      );
    }

    const usedSlugs = new Set<string>();
    for (const [i, entry] of allowed.entries()) {
      const role = ROSTER[entry.name];
      let slug = role?.slug ?? `user-${i + 1}`;
      while (usedSlugs.has(slug)) slug = `${slug}-${i + 1}`;
      usedSlugs.add(slug);

      if (!role) {
        console.warn(
          `⚠️  "${entry.name}" is not in ROSTER — seeded as a regular member with slug "${slug}".`,
        );
      }

      await tx
        .insert(s.users)
        .values({
          email: entry.email,
          name: entry.name,
          slug,
          avatarUrl: `/avatars/${slug}.jpg`,
          isAdmin: role?.isAdmin ?? false,
          isShopper: role?.isShopper ?? false,
        })
        .onConflictDoUpdate({
          target: s.users.email,
          // onboardedAt is intentionally absent: re-seeding must not force
          // everyone back through the onboarding flow.
          set: {
            name: entry.name,
            slug,
            avatarUrl: `/avatars/${slug}.jpg`,
            isAdmin: role?.isAdmin ?? false,
            isShopper: role?.isShopper ?? false,
          },
        });
    }

    /* ---------------------------------------------------------------- gear */
    let gearCount = 0;
    for (const [catIndex, cat] of GEAR.entries()) {
      const [category] = await tx
        .insert(s.gearCategories)
        .values({ name: cat.name, sort: catIndex })
        .onConflictDoUpdate({ target: s.gearCategories.name, set: { sort: catIndex } })
        .returning();

      for (const item of cat.items) {
        await tx
          .insert(s.gearItems)
          .values({
            categoryId: category.id,
            name: item.name,
            qtyNeeded: item.qtyNeeded,
            qtyLabel: item.qtyLabel ?? null,
            isOptional: item.isOptional ?? false,
            isOpenQuantity: item.isOpenQuantity ?? false,
            notes: item.notes ?? null,
          })
          .onConflictDoUpdate({
            target: [s.gearItems.categoryId, s.gearItems.name],
            set: {
              qtyNeeded: item.qtyNeeded,
              qtyLabel: item.qtyLabel ?? null,
              isOptional: item.isOptional ?? false,
              isOpenQuantity: item.isOpenQuantity ?? false,
              notes: item.notes ?? null,
            },
          });
        gearCount++;
      }
    }

    /* ------------------------------------------------------------ shopping */
    let shoppingCount = 0;
    for (const [catIndex, cat] of SHOPPING.entries()) {
      const [category] = await tx
        .insert(s.shoppingCategories)
        .values({ name: cat.name, sort: catIndex })
        .onConflictDoUpdate({ target: s.shoppingCategories.name, set: { sort: catIndex } })
        .returning();

      for (const [i, item] of cat.items.entries()) {
        await tx
          .insert(s.shoppingItems)
          .values({
            categoryId: category.id,
            name: item.name,
            quantityText: item.quantityText ?? null,
            notes: item.notes ?? null,
            sort: i,
          })
          .onConflictDoUpdate({
            target: s.shoppingItems.name,
            // isBought / boughtBy / boughtAt are intentionally absent: re-seeding
            // must never un-buy something a shopper has already picked up.
            set: {
              categoryId: category.id,
              quantityText: item.quantityText ?? null,
              notes: item.notes ?? null,
              sort: i,
            },
          });
        shoppingCount++;
      }
    }

    /* --------------------------------------------------------------- meals */
    const shoppingRows = await tx
      .select({ id: s.shoppingItems.id, name: s.shoppingItems.name })
      .from(s.shoppingItems);
    const byName = new Map(shoppingRows.map((r) => [r.name, r.id]));

    // Fail loudly on a typo between MEALS[].links and SHOPPING[].items[].name,
    // rather than silently seeding a meal with missing ingredients.
    const missing = [...new Set(MEALS.flatMap((m) => m.links))].filter((n) => !byName.has(n));
    if (missing.length > 0) {
      throw new Error(
        `Meal links reference unknown shopping items: ${missing.join(", ")}`,
      );
    }

    let linkCount = 0;
    for (const [i, meal] of MEALS.entries()) {
      const [row] = await tx
        .insert(s.meals)
        .values({
          date: meal.date,
          slot: meal.slot,
          title: meal.title,
          description: meal.description ?? null,
          sort: i,
        })
        .onConflictDoUpdate({
          target: [s.meals.date, s.meals.slot],
          set: { title: meal.title, description: meal.description ?? null, sort: i },
        })
        .returning();

      for (const name of meal.links) {
        await tx
          .insert(s.mealShoppingItems)
          .values({ mealId: row.id, shoppingItemId: byName.get(name)! })
          .onConflictDoNothing();
        linkCount++;
      }
    }

    console.log(
      `✅ seeded: ${allowed.length} users · ${GEAR.length} gear categories / ${gearCount} items · ` +
        `${SHOPPING.length} shopping categories / ${shoppingCount} items · ` +
        `${MEALS.length} meals / ${linkCount} links`,
    );
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ seed failed:", err);
  process.exit(1);
});
