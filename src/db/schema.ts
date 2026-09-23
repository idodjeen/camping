import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Meal slots are a real Postgres enum rather than a text column so the DB itself
 * rejects a typo'd slot. The order declared here is also the order we sort by
 * within a day (breakfast -> lunch -> dinner).
 */
export const mealSlot = pgEnum("meal_slot", ["breakfast", "lunch", "dinner"]);

/* ------------------------------------------------------------------ users */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** Latin slug — drives the avatar filename at /avatars/{slug}.jpg */
  slug: text("slug").notNull().unique(),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isShopper: boolean("is_shopper").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------- trip */

export const trip = pgTable("trip", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // mode: "string" keeps these as plain "2026-10-01" strings. A JS Date here
  // would be shifted by the server's UTC offset and could render as 30.9 in Israel.
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  locationName: text("location_name"),
});

/* ------------------------------------------------------------------- gear */

export const gearCategories = pgTable("gear_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sort: integer("sort").notNull().default(0),
});

export const gearItems = pgTable(
  "gear_items",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => gearCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Max of the original range: "כירות גז (2-3)" -> 3. Null when open quantity. */
    qtyNeeded: integer("qty_needed"),
    /** The original human text: "2-3", "כמה שיותר". Null when a plain single item. */
    qtyLabel: text("qty_label"),
    isOptional: boolean("is_optional").notNull().default(false),
    /** "הרבה" / "כמה שיותר" — many people may claim, no cap, never "full". */
    isOpenQuantity: boolean("is_open_quantity").notNull().default(false),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("gear_items_category_name_uq").on(t.categoryId, t.name)],
);

export const gearClaims = pgTable(
  "gear_claims",
  {
    id: serial("id").primaryKey(),
    gearItemId: integer("gear_item_id")
      .notNull()
      .references(() => gearItems.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull().default(1),
    isPacked: boolean("is_packed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // One row per person per item; claiming again updates qty instead of stacking rows.
  (t) => [unique("gear_claims_item_user_uq").on(t.gearItemId, t.userId)],
);

/* -------------------------------------------------------------- shopping */

export const shoppingCategories = pgTable("shopping_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sort: integer("sort").notNull().default(0),
});

export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => shoppingCategories.id, { onDelete: "cascade" }),
    /** Bare noun ("בטטות") so meal links can resolve by name. */
    name: text("name").notNull().unique(),
    /** "3", "כ-2 ק\"ג", "200 גרם" */
    quantityText: text("quantity_text"),
    notes: text("notes"),
    isBought: boolean("is_bought").notNull().default(false),
    boughtBy: integer("bought_by").references(() => users.id, { onDelete: "set null" }),
    boughtAt: timestamp("bought_at", { withTimezone: true }),
    // Null for the 27 seeded rows: nobody gets credit for the original list.
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    sort: integer("sort").notNull().default(0),
  },
);

/* ------------------------------------------------------------------ meals */

export const meals = pgTable(
  "meals",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    slot: mealSlot("slot").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [unique("meals_date_slot_uq").on(t.date, t.slot)],
);

export const mealShoppingItems = pgTable(
  "meal_shopping_items",
  {
    mealId: integer("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    shoppingItemId: integer("shopping_item_id")
      .notNull()
      .references(() => shoppingItems.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.mealId, t.shoppingItemId] })],
);

/* -------------------------------------------------------- personal items */

export const personalItems = pgTable("personal_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isPacked: boolean("is_packed").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many }) => ({
  claims: many(gearClaims),
  personalItems: many(personalItems),
}));

export const gearCategoriesRelations = relations(gearCategories, ({ many }) => ({
  items: many(gearItems),
}));

export const gearItemsRelations = relations(gearItems, ({ one, many }) => ({
  category: one(gearCategories, {
    fields: [gearItems.categoryId],
    references: [gearCategories.id],
  }),
  claims: many(gearClaims),
}));

export const gearClaimsRelations = relations(gearClaims, ({ one }) => ({
  item: one(gearItems, { fields: [gearClaims.gearItemId], references: [gearItems.id] }),
  user: one(users, { fields: [gearClaims.userId], references: [users.id] }),
}));

export const shoppingCategoriesRelations = relations(shoppingCategories, ({ many }) => ({
  items: many(shoppingItems),
}));

export const shoppingItemsRelations = relations(shoppingItems, ({ one, many }) => ({
  category: one(shoppingCategories, {
    fields: [shoppingItems.categoryId],
    references: [shoppingCategories.id],
  }),
  buyer: one(users, { fields: [shoppingItems.boughtBy], references: [users.id] }),
  creator: one(users, {
    fields: [shoppingItems.createdBy],
    references: [users.id],
    relationName: "shoppingCreator",
  }),
  mealLinks: many(mealShoppingItems),
}));

export const mealsRelations = relations(meals, ({ many }) => ({
  shoppingLinks: many(mealShoppingItems),
}));

export const mealShoppingItemsRelations = relations(mealShoppingItems, ({ one }) => ({
  meal: one(meals, { fields: [mealShoppingItems.mealId], references: [meals.id] }),
  shoppingItem: one(shoppingItems, {
    fields: [mealShoppingItems.shoppingItemId],
    references: [shoppingItems.id],
  }),
}));

export const personalItemsRelations = relations(personalItems, ({ one }) => ({
  user: one(users, { fields: [personalItems.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type GearItem = typeof gearItems.$inferSelect;
export type GearClaim = typeof gearClaims.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type PersonalItem = typeof personalItems.$inferSelect;
export type Trip = typeof trip.$inferSelect;
