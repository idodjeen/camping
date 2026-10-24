/**
 * Small builders so a test reads as a scenario:
 *
 *   const { group, people } = await seedGroup({ dana: "admin", gil: "editor", vered: "viewer" });
 *   const camp = await seedTrip(group, { on: [people.dana, people.gil], shoppers: [people.dana] });
 *   const stove = await seedGear(camp, "בלון גז", { qty: 4 });
 *
 * Names, emails and slugs are made unique per call, so builders can be called
 * any number of times in one test file.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  comments,
  gearCategories,
  gearItems,
  groupMembers,
  groups,
  notifications,
  trip,
  tripMembers,
  users,
  type NotificationKind,
  type User,
} from "@/db/schema";

type Role = "admin" | "editor" | "viewer";
type Group = typeof groups.$inferSelect;
type Trip = typeof trip.$inferSelect;
type GearItem = typeof gearItems.$inferSelect;
type Comment = typeof comments.$inferSelect;

let seq = 0;
const next = () => ++seq;

export async function seedPerson(name: string, opts: { superAdmin?: boolean } = {}): Promise<User> {
  const n = next();
  const [row] = await db
    .insert(users)
    .values({
      name,
      email: `test-${n}@example.test`,
      slug: `test-${n}`,
      isSuperAdmin: opts.superAdmin ?? false,
    })
    .returning();
  return row;
}

/** A group with one person per key, each with that role. The keys become the people's names. */
export async function seedGroup<K extends string>(
  members: Record<K, Role>,
  name = `קבוצה ${next()}`,
): Promise<{ group: Group; people: Record<K, User> }> {
  const [group] = await db.insert(groups).values({ name }).returning();
  const people = {} as Record<K, User>;
  for (const key of Object.keys(members) as K[]) {
    people[key] = await seedPerson(key);
    await db.insert(groupMembers).values({ groupId: group.id, userId: people[key].id, role: members[key] });
  }
  return { group, people };
}

/** A trip of the group, with the given people on it. Dates are plain "YYYY-MM-DD" strings. */
export async function seedTrip(
  group: Group,
  opts: { on: User[]; shoppers?: User[]; name?: string; startDate?: string; endDate?: string },
): Promise<Trip> {
  const [row] = await db
    .insert(trip)
    .values({
      groupId: group.id,
      name: opts.name ?? `טיול ${next()}`,
      startDate: opts.startDate ?? "2026-10-01",
      endDate: opts.endDate ?? "2026-10-03",
      lat: 33.05,
      lng: 35.5,
    })
    .returning();
  const shoppers = new Set((opts.shoppers ?? []).map((p) => p.id));
  for (const person of opts.on) {
    await db
      .insert(tripMembers)
      .values({ tripId: row.id, userId: person.id, isShopper: shoppers.has(person.id) });
  }
  return row;
}

/** A gear item in the trip's "כללי" category (created on first use). */
export async function seedGear(
  t: Trip,
  name: string,
  opts: { qty?: number; optional?: boolean } = {},
): Promise<GearItem> {
  await db
    .insert(gearCategories)
    .values({ tripId: t.id, name: "כללי" })
    .onConflictDoNothing();
  const [category] = await db
    .select()
    .from(gearCategories)
    .where(and(eq(gearCategories.tripId, t.id), eq(gearCategories.name, "כללי")));
  const [row] = await db
    .insert(gearItems)
    .values({
      tripId: t.id,
      categoryId: category.id,
      name,
      qtyNeeded: opts.qty ?? 1,
      isOptional: opts.optional ?? false,
    })
    .returning();
  return row;
}

/** A message on a gear item's thread, or in the general chat when `on` is left out. */
export async function seedComment(t: Trip, author: User, body: string, on?: GearItem): Promise<Comment> {
  const [row] = await db
    .insert(comments)
    .values({ tripId: t.id, userId: author.id, body, gearItemId: on?.id ?? null })
    .returning();
  return row;
}

/** A bell row for `to`, written the way notify() writes it. Unread unless `read` is set. */
export async function seedNotification(
  t: Trip,
  to: User,
  opts: { kind: NotificationKind; actor: User; thread: string; comment?: Comment; gear?: GearItem; read?: boolean },
) {
  const [row] = await db
    .insert(notifications)
    .values({
      tripId: t.id,
      userId: to.id,
      kind: opts.kind,
      actorId: opts.actor.id,
      threadKey: opts.thread,
      commentId: opts.comment?.id ?? null,
      gearItemId: opts.gear?.id ?? null,
      readAt: opts.read ? new Date() : null,
    })
    .returning();
  return row;
}
