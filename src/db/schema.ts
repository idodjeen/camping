import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
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
  /** Moving to `group_members.role`; dropped in phase 2 of docs/groups-and-trips.md. */
  isAdmin: boolean("is_admin").notNull().default(false),
  /** Moving to `trip_members.is_shopper`; dropped in phase 2 of docs/groups-and-trips.md. */
  isShopper: boolean("is_shopper").notNull().default(false),
  /**
   * Sees and manages every group. Set in the database only: no screen in the
   * app grants it, so a compromised group admin cannot climb to it.
   */
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  /** Which kinds of notification reach the bell. All on until the person opts out. */
  notifyMentions: boolean("notify_mentions").notNull().default(true),
  notifyCovered: boolean("notify_covered").notNull().default(true),
  notifyMessages: boolean("notify_messages").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------------------------------------------- groups */

/**
 * A group of friends. It owns the people and their roles; everything the app
 * is actually about (gear, meals, chat, money) lives one level down, on a trip.
 */
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberRole = pgEnum("member_role", ["admin", "editor", "viewer"]);

/**
 * Who is in a group, and as what. The role lives here rather than on `users`
 * so the same person can run one group and only watch another.
 */
export const groupMembers = pgTable(
  "group_members",
  {
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("editor"),
    addedBy: integer("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    // "Which groups am I in?" is asked on every request.
    index("group_members_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------------- trip */

/**
 * Every trip of every group. The singular table name is a leftover from the
 * single-trip days: renaming it needs drizzle-kit's interactive prompt.
 */
export const trip = pgTable(
  "trip",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // mode: "string" keeps these as plain "2026-10-01" strings. A JS Date here
    // would be shifted by the server's UTC offset and could render as 30.9 in Israel.
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    locationName: text("location_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("trip_group_idx").on(t.groupId)],
);

/**
 * Who is on a trip. Separate from group membership because not everyone comes
 * every time: only these people are split into expenses, ranked on the
 * leaderboard, and reached by @all and reminders. Shopping is per trip too.
 */
export const tripMembers = pgTable(
  "trip_members",
  {
    tripId: integer("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isShopper: boolean("is_shopper").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tripId, t.userId] }),
    index("trip_members_user_idx").on(t.userId),
  ],
);

/**
 * The trip a content row belongs to.
 *
 * DEFAULT 1 is temporary (phase 1 of docs/groups-and-trips.md): it lets the
 * current single-trip code keep inserting unchanged. Phase 2 passes the trip
 * explicitly everywhere and drops the default, so a forgotten trip id fails
 * loudly instead of quietly landing in someone else's trip.
 *
 * Rows that point at other trip-scoped rows also carry a composite foreign key
 * on (trip_id, x_id), so the database itself refuses a link across trips.
 */
const tripId = () =>
  integer("trip_id")
    .notNull()
    .default(1)
    .references(() => trip.id, { onDelete: "cascade" });

/* ------------------------------------------------------------------- gear */

export const gearCategories = pgTable(
  "gear_categories",
  {
    id: serial("id").primaryKey(),
    tripId: tripId(),
    name: text("name").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    unique("gear_categories_trip_name_uq").on(t.tripId, t.name),
    // Target of the composite FK from gear_items; (id) alone is already unique.
    unique("gear_categories_trip_id_uq").on(t.tripId, t.id),
  ],
);

export const gearItems = pgTable(
  "gear_items",
  {
    id: serial("id").primaryKey(),
    tripId: tripId(),
    categoryId: integer("category_id").notNull(),
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
  (t) => [
    unique("gear_items_category_name_uq").on(t.categoryId, t.name),
    unique("gear_items_trip_id_uq").on(t.tripId, t.id),
    foreignKey({
      name: "gear_items_category_fk",
      columns: [t.tripId, t.categoryId],
      foreignColumns: [gearCategories.tripId, gearCategories.id],
    }).onDelete("cascade"),
  ],
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

export const shoppingCategories = pgTable(
  "shopping_categories",
  {
    id: serial("id").primaryKey(),
    tripId: tripId(),
    name: text("name").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    unique("shopping_categories_trip_name_uq").on(t.tripId, t.name),
    unique("shopping_categories_trip_id_uq").on(t.tripId, t.id),
  ],
);

export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: serial("id").primaryKey(),
    tripId: tripId(),
    categoryId: integer("category_id").notNull(),
    /** Bare noun ("בטטות") so meal links can resolve by name; unique per trip. */
    name: text("name").notNull(),
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
  (t) => [
    unique("shopping_items_trip_name_uq").on(t.tripId, t.name),
    unique("shopping_items_trip_id_uq").on(t.tripId, t.id),
    foreignKey({
      name: "shopping_items_category_fk",
      columns: [t.tripId, t.categoryId],
      foreignColumns: [shoppingCategories.tripId, shoppingCategories.id],
    }).onDelete("cascade"),
  ],
);

/* ------------------------------------------------------------------ meals */

export const meals = pgTable(
  "meals",
  {
    id: serial("id").primaryKey(),
    tripId: tripId(),
    date: date("date", { mode: "string" }).notNull(),
    slot: mealSlot("slot").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    unique("meals_trip_date_slot_uq").on(t.tripId, t.date, t.slot),
    unique("meals_trip_id_uq").on(t.tripId, t.id),
  ],
);

export const mealShoppingItems = pgTable(
  "meal_shopping_items",
  {
    tripId: tripId(),
    mealId: integer("meal_id").notNull(),
    shoppingItemId: integer("shopping_item_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.mealId, t.shoppingItemId] }),
    // Both sides must be in the link's own trip, so a meal can never list
    // another group's groceries.
    foreignKey({
      name: "meal_shopping_items_meal_fk",
      columns: [t.tripId, t.mealId],
      foreignColumns: [meals.tripId, meals.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "meal_shopping_items_item_fk",
      columns: [t.tripId, t.shoppingItemId],
      foreignColumns: [shoppingItems.tripId, shoppingItems.id],
    }).onDelete("cascade"),
  ],
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
    tripId: tripId(),
    gearItemId: integer("gear_item_id"),
    shoppingItemId: integer("shopping_item_id"),
    mealId: integer("meal_id"),
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
    unique("comments_trip_id_uq").on(t.tripId, t.id),
    // Composite FKs with a nullable second column: Postgres skips the check
    // when the subject is null, which is exactly a general chat message.
    foreignKey({
      name: "comments_gear_item_fk",
      columns: [t.tripId, t.gearItemId],
      foreignColumns: [gearItems.tripId, gearItems.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "comments_shopping_item_fk",
      columns: [t.tripId, t.shoppingItemId],
      foreignColumns: [shoppingItems.tripId, shoppingItems.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "comments_meal_fk",
      columns: [t.tripId, t.mealId],
      foreignColumns: [meals.tripId, meals.id],
    }).onDelete("cascade"),
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
    tripId: tripId(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    /** Who caused it: the author of the message, or whoever took the last unit. */
    actorId: integer("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: integer("comment_id"),
    gearItemId: integer("gear_item_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.id),
    foreignKey({
      name: "notifications_comment_fk",
      columns: [t.tripId, t.commentId],
      foreignColumns: [comments.tripId, comments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "notifications_gear_item_fk",
      columns: [t.tripId, t.gearItemId],
      foreignColumns: [gearItems.tripId, gearItems.id],
    }).onDelete("cascade"),
  ],
);

/* ------------------------------------------------------- push subscriptions */

/**
 * One row per browser / installed-app instance that agreed to Web Push.
 *
 * A person can have several (phone PWA + laptop), so this hangs off users
 * one-to-many. `endpoint` is the push service's URL for that instance and is
 * globally unique, which makes re-subscribing an idempotent upsert. The two
 * keys are what lets us encrypt a payload only that device can read.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/* -------------------------------------------------------- personal items */

/** A packing list per person per trip: next year's bag starts empty. */
export const personalItems = pgTable("personal_items", {
  id: serial("id").primaryKey(),
  tripId: tripId(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isPacked: boolean("is_packed").notNull().default(false),
  // How many the person actually packed; asked for when ticking the box.
  qty: integer("qty"),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------- expenses */

/**
 * Money is stored as integer agorot (1/100 ₪), never floats: 0.1 + 0.2 must not
 * leave a 1-agora hole in somebody's balance.
 *
 * `paid_by` and `created_by` are separate because someone may enter an expense
 * on behalf of the friend who actually paid.
 */
export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    tripId: tripId(),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    paidBy: integer("paid_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("expenses_amount_positive", sql`${t.amount} > 0`)],
);

/**
 * Each person's share, computed once when the expense is saved and stored.
 * An equal split of an amount that does not divide evenly gives the leftover
 * agorot to specific people; freezing the result here keeps the numbers stable
 * instead of recomputing them (possibly differently) on every read.
 */
export const expenseShares = pgTable(
  "expense_shares",
  {
    expenseId: integer("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.userId] })],
);

/** "Dana paid Ido ₪50" — a payment outside the app, recorded to zero out a debt. */
export const settlements = pgTable(
  "settlements",
  {
    id: serial("id").primaryKey(),
    tripId: tripId(),
    fromUser: integer("from_user")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUser: integer("to_user")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("settlements_amount_positive", sql`${t.amount} > 0`),
    check("settlements_distinct_people", sql`${t.fromUser} <> ${t.toUser}`),
  ],
);

/* -------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many }) => ({
  claims: many(gearClaims),
  personalItems: many(personalItems),
  groupMemberships: many(groupMembers),
  tripMemberships: many(tripMembers),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  trips: many(trip),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const tripRelations = relations(trip, ({ one, many }) => ({
  group: one(groups, { fields: [trip.groupId], references: [groups.id] }),
  members: many(tripMembers),
}));

export const tripMembersRelations = relations(tripMembers, ({ one }) => ({
  trip: one(trip, { fields: [tripMembers.tripId], references: [trip.id] }),
  user: one(users, { fields: [tripMembers.userId], references: [users.id] }),
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
export type Expense = typeof expenses.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type PersonalItem = typeof personalItems.$inferSelect;
export type Trip = typeof trip.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type TripMember = typeof tripMembers.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];
