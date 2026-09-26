import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
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
  /** Which kinds of notification reach the bell. All on until the person opts out. */
  notifyMentions: boolean("notify_mentions").notNull().default(true),
  notifyCovered: boolean("notify_covered").notNull().default(true),
  notifyMessages: boolean("notify_messages").notNull().default(true),
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

/* ------------------------------------------------------------- comments */

/**
 * One thread per item, across all three lists — plus the general chat, which
 * is the comments with no item at all.
 *
 * Three nullable foreign keys rather than a `subject_type` + `subject_id`
 * pair: a string discriminator cannot be a foreign key, so deleting a gear
 * item would silently orphan its thread. `num_nonnulls` enforces at most one
 * subject in the database itself (zero means a general chat message), and each
 * FK cascades on its own.
 */
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    gearItemId: integer("gear_item_id").references(() => gearItems.id, { onDelete: "cascade" }),
    shoppingItemId: integer("shopping_item_id").references(() => shoppingItems.id, {
      onDelete: "cascade",
    }),
    mealId: integer("meal_id").references(() => meals.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "comments_one_subject",
      sql`num_nonnulls(${t.gearItemId}, ${t.shoppingItemId}, ${t.mealId}) <= 1`,
    ),
  ],
);

/**
 * Who a comment is addressed to.
 *
 * Its own table rather than an array column on `comments` because `read_at`
 * belongs to one person and one comment — which is exactly what the unread
 * badge counts, and it wants an index rather than an array scan.
 */
export const commentMentions = pgTable(
  "comment_mentions",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [unique("comment_mentions_comment_user_uq").on(t.commentId, t.userId)],
);

/* --------------------------------------------------------- notifications */

export const notificationKind = pgEnum("notification_kind", ["covered", "message"]);

/**
 * The bell's rows for everything that is not a tag ("mentions" already live in
 * `comment_mentions`, which the banner and the nav dots read).
 *
 * Written when the event happens — one row per recipient — rather than
 * computed on read, because "covered" is a moment (the last unit got claimed)
 * that is not recoverable from the current state, and because `read_at`
 * belongs to one person and one event. Both subject FKs cascade, so deleting
 * the message or the item takes its notifications with it.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    /** Who caused it: the author of the message, or whoever took the last unit. */
    actorId: integer("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: integer("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    gearItemId: integer("gear_item_id").references(() => gearItems.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.id)],
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

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, { fields: [comments.userId], references: [users.id] }),
  gearItem: one(gearItems, { fields: [comments.gearItemId], references: [gearItems.id] }),
  shoppingItem: one(shoppingItems, {
    fields: [comments.shoppingItemId],
    references: [shoppingItems.id],
  }),
  meal: one(meals, { fields: [comments.mealId], references: [meals.id] }),
  mentions: many(commentMentions),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  actor: one(users, { fields: [notifications.actorId], references: [users.id] }),
  comment: one(comments, { fields: [notifications.commentId], references: [comments.id] }),
  gearItem: one(gearItems, { fields: [notifications.gearItemId], references: [gearItems.id] }),
}));

export const commentMentionsRelations = relations(commentMentions, ({ one }) => ({
  comment: one(comments, { fields: [commentMentions.commentId], references: [comments.id] }),
  user: one(users, { fields: [commentMentions.userId], references: [users.id] }),
}));

export type Comment = typeof comments.$inferSelect;
export type User = typeof users.$inferSelect;
export type GearItem = typeof gearItems.$inferSelect;
export type GearClaim = typeof gearClaims.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type PersonalItem = typeof personalItems.$inferSelect;
export type Trip = typeof trip.$inferSelect;
