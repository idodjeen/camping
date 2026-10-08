import { and, asc, count, desc, eq, gte, inArray, or, sql } from "drizzle-orm";

import { db, type Tx } from "@/db";
import {
  expenseShares,
  expenses,
  gearClaims,
  gearItems,
  groupMembers,
  groups,
  settlements,
  trip,
  tripMembers,
  users,
  type MemberRole,
} from "@/db/schema";
import { parseCoords } from "@/lib/coords";
import { addDays, todayInIsrael } from "@/lib/dates";
import { ROLE_ORDER, readPeople } from "@/lib/groups";
import { clashes, type PersonInput } from "@/lib/people";
import type { Invitee } from "@/lib/invite-email";
import { HttpError } from "@/lib/session";
import { fillFromTemplate, fillFromTrip } from "@/lib/trip-template";
import { createUser } from "@/lib/user";

/**
 * The group admin's page (/g/[groupId]): its people and their roles, its
 * trips, and who is on each one. Every function here assumes the caller has
 * already passed requireGroupAdmin() for `groupId`.
 *
 * Trip membership follows the role. Admins and editors are on every trip
 * that hasn't ended; viewers are on none, since being on a trip puts you in
 * its expense splits. Taking someone off a trip releases their gear claims
 * there, and is refused while they have money on it: balances must never
 * lose a person.
 */

export type AdminMember = { userId: number; name: string; email: string; role: MemberRole };

export type AdminTrip = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  locationName: string | null;
  /** Ended before today (Israel): people added to the group later aren't put on it. */
  ended: boolean;
  people: { userId: number; isShopper: boolean }[];
};

export type GroupDetail = {
  group: { id: number; name: string };
  members: AdminMember[];
  trips: AdminTrip[];
};

export async function groupDetail(groupId: number): Promise<GroupDetail> {
  const [[group], members, trips, people] = await Promise.all([
    db.select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.id, groupId)),
    db
      .select({ userId: users.id, name: users.name, email: users.email, role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId)),
    db.select().from(trip).where(eq(trip.groupId, groupId)).orderBy(desc(trip.startDate), desc(trip.id)),
    db
      .select({ tripId: tripMembers.tripId, userId: tripMembers.userId, isShopper: tripMembers.isShopper })
      .from(tripMembers)
      .innerJoin(trip, eq(trip.id, tripMembers.tripId))
      .where(eq(trip.groupId, groupId)),
  ]);

  const today = todayInIsrael();
  return {
    group,
    members: members.sort(
      (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, "he"),
    ),
    trips: trips.map((t) => ({
      id: t.id,
      name: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      locationName: t.locationName,
      ended: t.endDate < today,
      people: people
        .filter((p) => p.tripId === t.id)
        .map(({ userId, isShopper }) => ({ userId, isShopper })),
    })),
  };
}

/* ------------------------------------------------------------- shared steps */

/**
 * Every change to a group's people starts here. Locking the group's row
 * serialises them: two admins demoting each other at the same moment can't
 * both see "another admin is left", and two lists added at once can't both
 * pass the name check with the same name. `no key update` still lets other
 * rows reference the group meanwhile.
 */
async function lockGroup(tx: Tx, groupId: number) {
  await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).for("no key update");
}

async function memberOf(tx: Tx, groupId: number, userId: number) {
  const [row] = await tx
    .select({ role: groupMembers.role, name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  if (!row) throw new HttpError(404, "לא נמצא/ה בקבוצה");
  return row;
}

async function assertNotLastAdmin(tx: Tx, groupId: number, name: string) {
  const [{ n }] = await tx
    .select({ n: count() })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "admin")));
  if (n <= 1) {
    throw new HttpError(409, `${name} המנהל/ת היחיד/ה של הקבוצה. קודם צריך למנות מנהל/ת נוסף/ת.`);
  }
}

const groupTripIds = async (tx: Tx, groupId: number) =>
  (await tx.select({ id: trip.id }).from(trip).where(eq(trip.groupId, groupId))).map((t) => t.id);

/**
 * Refuses when this person has money on any of these trips: an expense they
 * paid, a share of one, or a payment either way. Names the trip.
 */
async function assertNoMoney(tx: Tx, userId: number, name: string, tripIds: number[]) {
  if (tripIds.length === 0) return;
  const [row] = await tx
    .select({ name: trip.name })
    .from(trip)
    .where(
      and(
        inArray(trip.id, tripIds),
        or(
          sql`exists (select 1 from ${expenses} where ${expenses.tripId} = ${trip.id} and ${expenses.paidBy} = ${userId})`,
          sql`exists (select 1 from ${expenseShares} join ${expenses} on ${expenses.id} = ${expenseShares.expenseId}
                      where ${expenses.tripId} = ${trip.id} and ${expenseShares.userId} = ${userId})`,
          sql`exists (select 1 from ${settlements} where ${settlements.tripId} = ${trip.id}
                      and (${settlements.fromUser} = ${userId} or ${settlements.toUser} = ${userId}))`,
        ),
      ),
    )
    .orderBy(desc(trip.startDate))
    .limit(1);
  if (row) {
    throw new HttpError(
      409,
      `${name} מופיע/ה בהוצאות או בתשלומים של "${row.name}", ולכן אי אפשר להוריד אותו/ה מהטיול בלי לשבש את החשבון.`,
    );
  }
}

/** Off these trips: their row there, and whatever gear they had claimed on them. */
async function leaveTrips(tx: Tx, userId: number, tripIds: number[]) {
  if (tripIds.length === 0) return;
  await tx
    .delete(gearClaims)
    .where(
      and(
        eq(gearClaims.userId, userId),
        inArray(
          gearClaims.gearItemId,
          tx.select({ id: gearItems.id }).from(gearItems).where(inArray(gearItems.tripId, tripIds)),
        ),
      ),
    );
  await tx
    .delete(tripMembers)
    .where(and(eq(tripMembers.userId, userId), inArray(tripMembers.tripId, tripIds)));
}

/** Onto every trip of the group that hasn't ended. */
async function joinOpenTrips(tx: Tx, groupId: number, userIds: number[]) {
  if (userIds.length === 0) return;
  const open = await tx
    .select({ id: trip.id })
    .from(trip)
    .where(and(eq(trip.groupId, groupId), gte(trip.endDate, todayInIsrael())));
  if (open.length === 0) return;
  await tx
    .insert(tripMembers)
    .values(open.flatMap((t) => userIds.map((userId) => ({ tripId: t.id, userId }))))
    .onConflictDoNothing();
}

/* ------------------------------------------------------------------ members */

export type NewMembers = { people: PersonInput[]; role: "editor" | "viewer" };

/** The request body, checked. Throws a 400 naming what to fix. */
export function parseNewMembers(raw: unknown): NewMembers {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (body.role !== "editor" && body.role !== "viewer") throw new HttpError(400, "תפקיד לא תקין");
  const problems: string[] = [];
  const people = readPeople(body.people, body.role === "viewer" ? "צפייה" : "חברים", problems);
  if (problems.length > 0) throw new HttpError(400, problems.join("\n"));
  if (people.length === 0) throw new HttpError(400, "לא נמצאו אנשים להוספה");
  return { people, role: body.role };
}

/**
 * Adds people to the group, as editors or viewers. Like createGroup(), people
 * are matched by email: someone who already has a row keeps their name, and
 * anyone new gets a row (which is also what lets them sign in). Names must be
 * unique across the whole group, existing members included.
 */
export async function addMembers(groupId: number, input: NewMembers, by: number) {
  return db.transaction(async (tx) => {
    await lockGroup(tx, groupId);

    const current = await tx
      .select({ email: users.email, name: users.name })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId));
    const inGroup = new Map(current.map((m) => [m.email, m.name]));
    const already = input.people.filter((p) => inGroup.has(p.email));
    if (already.length > 0) {
      throw new HttpError(
        400,
        already.map((p) => `${p.email} כבר בקבוצה (בשם ${inGroup.get(p.email)})`).join("\n"),
      );
    }

    const existing = await tx
      .select()
      .from(users)
      .where(inArray(users.email, input.people.map((p) => p.email)));
    const byEmail = new Map(existing.map((u) => [u.email, u]));

    // The name each person will actually have in the group, after everyone already in it.
    const problems = clashes([
      ...current,
      ...input.people.map((p) => ({ email: p.email, name: byEmail.get(p.email)?.name ?? p.name })),
    ]);
    if (problems.length > 0) throw new HttpError(400, problems.join("\n"));

    const kept: { email: string; typed: string; name: string }[] = [];
    const added: Invitee[] = [];
    for (const p of input.people) {
      const found = byEmail.get(p.email);
      if (found && found.name !== p.name) kept.push({ email: p.email, typed: p.name, name: found.name });
      const user = found ?? (await createUser(tx, p));
      await tx.insert(groupMembers).values({ groupId, userId: user.id, role: input.role, addedBy: by });
      added.push({ userId: user.id, email: user.email, name: user.name });
    }
    if (input.role === "editor") await joinOpenTrips(tx, groupId, added.map((a) => a.userId));

    // `people` is for the invite emails; the route keeps it out of the response.
    return { added: added.length, kept, people: added };
  });
}

const ROLES: readonly MemberRole[] = ["admin", "editor", "viewer"];

export function parseRole(raw: unknown): MemberRole {
  const role = (raw && typeof raw === "object" ? (raw as Record<string, unknown>).role : null) as MemberRole;
  if (!ROLES.includes(role)) throw new HttpError(400, "תפקיד לא תקין");
  return role;
}

/**
 * Admin, editor or viewer. The last admin can't step down. Becoming a viewer
 * takes them off the group's trips (refused while they have money on one);
 * leaving viewer puts them on the trips that haven't ended.
 */
export async function changeRole(groupId: number, userId: number, role: MemberRole) {
  return db.transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const member = await memberOf(tx, groupId, userId);
    if (member.role === role) return { role };
    if (member.role === "admin") await assertNotLastAdmin(tx, groupId, member.name);

    if (role === "viewer") {
      const tripIds = await groupTripIds(tx, groupId);
      await assertNoMoney(tx, userId, member.name, tripIds);
      await leaveTrips(tx, userId, tripIds);
    } else if (member.role === "viewer") {
      await joinOpenTrips(tx, groupId, [userId]);
    }

    await tx
      .update(groupMembers)
      .set({ role })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    return { role };
  });
}

/**
 * Out of the group and off all its trips. Nobody removes themselves, and the
 * last admin stays. Their user row stays too: they may be in other groups,
 * and if not, findActiveUser() already treats them as signed out.
 */
export async function removeMember(groupId: number, userId: number, by: number) {
  if (userId === by) throw new HttpError(409, "אי אפשר להסיר את עצמך מהקבוצה");
  return db.transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const member = await memberOf(tx, groupId, userId);
    if (member.role === "admin") await assertNotLastAdmin(tx, groupId, member.name);

    const tripIds = await groupTripIds(tx, groupId);
    await assertNoMoney(tx, userId, member.name, tripIds);
    await leaveTrips(tx, userId, tripIds);
    await tx
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    return { removed: true };
  });
}

/* ---------------------------------------------------------- trip membership */

export type TripMemberChange = { onTrip?: boolean; isShopper?: boolean };

export function parseTripMemberChange(raw: unknown): TripMemberChange {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const change: TripMemberChange = {};
  if (typeof body.onTrip === "boolean") change.onTrip = body.onTrip;
  if (typeof body.isShopper === "boolean") change.isShopper = body.isShopper;
  if (change.onTrip === undefined && change.isShopper === undefined) throw new HttpError(400, "אין מה לשנות");
  return change;
}

/**
 * Puts a member on one trip or takes them off it, and sets whether they shop
 * for it. Viewers can't be put on a trip; taking someone off follows the same
 * money rule as everywhere else.
 */
export async function setTripMember(
  groupId: number,
  tripId: number,
  userId: number,
  change: TripMemberChange,
) {
  return db.transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const [t] = await tx
      .select({ id: trip.id })
      .from(trip)
      .where(and(eq(trip.id, tripId), eq(trip.groupId, groupId)));
    if (!t) throw new HttpError(404, "הטיול לא נמצא");
    const member = await memberOf(tx, groupId, userId);

    const [current] = await tx
      .select({ isShopper: tripMembers.isShopper })
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
    const onTrip = change.onTrip ?? Boolean(current);

    if (!onTrip) {
      if (change.isShopper) throw new HttpError(400, "קודם צריך לצרף לטיול");
      if (current) {
        await assertNoMoney(tx, userId, member.name, [tripId]);
        await leaveTrips(tx, userId, [tripId]);
      }
      return { onTrip: false, isShopper: false };
    }

    if (member.role === "viewer") {
      throw new HttpError(409, `${member.name} בצפייה בלבד, ולכן לא בטיולים. כדי לצרף, קודם משנים לחבר/ה.`);
    }
    const isShopper = change.isShopper ?? current?.isShopper ?? false;
    await tx
      .insert(tripMembers)
      .values({ tripId, userId, isShopper })
      .onConflictDoUpdate({ target: [tripMembers.tripId, tripMembers.userId], set: { isShopper } });
    return { onTrip: true, isShopper };
  });
}

/* -------------------------------------------------------------------- trips */

const TRIP_NAME_MAX = 60;
const PLACE_MAX = 60;

export type NewTrip = {
  name: string;
  startDate: string;
  endDate: string;
  locationName: string | null;
  lat: number;
  lng: number;
  /** Start from the template, or copy this trip of the same group. */
  from: "template" | number;
};

/** A real calendar date as "YYYY-MM-DD" (so not 2026-02-30). */
const isDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && addDays(s, 0) === s;

/** The request body, checked field by field. Throws a 400 naming what to fix. */
export function parseNewTrip(raw: unknown): NewTrip {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const problems: string[] = [];

  const name = text(body.name);
  if (!name) problems.push("חסר שם לטיול");
  else if ([...name].length > TRIP_NAME_MAX) problems.push(`שם הטיול עד ${TRIP_NAME_MAX} תווים`);

  const startDate = text(body.startDate);
  const endDate = text(body.endDate);
  if (!isDate(startDate)) problems.push("תאריך ההתחלה לא תקין");
  else if (!isDate(endDate)) problems.push("תאריך הסיום לא תקין");
  else if (endDate < startDate) problems.push("הטיול מסתיים לפני שהוא מתחיל");

  const locationName = text(body.locationName) || null;
  if (locationName && [...locationName].length > PLACE_MAX) problems.push(`שם המקום עד ${PLACE_MAX} תווים`);

  const coords = parseCoords(text(body.coords));
  if ("error" in coords) problems.push(coords.error);

  const from = body.from === "template" ? "template" : Number(body.from);
  if (from !== "template" && !(Number.isInteger(from) && from > 0)) problems.push("לא ברור ממה להתחיל");

  if (problems.length > 0 || "error" in coords) throw new HttpError(400, problems.join("\n"));
  return { name, startDate, endDate, locationName, lat: coords.lat, lng: coords.lng, from };
}

/**
 * A new trip in the group, filled from the template or an earlier trip, with
 * every admin and editor on it. Whoever creates it does the shopping, if
 * they're on it (a super admin outside the group isn't).
 */
export async function createTrip(groupId: number, input: NewTrip, by: number) {
  return db.transaction(async (tx) => {
    await lockGroup(tx, groupId);

    let source: { id: number; startDate: string } | undefined;
    if (input.from !== "template") {
      [source] = await tx
        .select({ id: trip.id, startDate: trip.startDate })
        .from(trip)
        .where(and(eq(trip.id, input.from), eq(trip.groupId, groupId)));
      if (!source) throw new HttpError(400, "הטיול להעתקה לא נמצא בקבוצה");
    }

    const [created] = await tx
      .insert(trip)
      .values({
        groupId,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        lat: input.lat,
        lng: input.lng,
        locationName: input.locationName,
      })
      .returning({ id: trip.id });

    if (source) await fillFromTrip(tx, created.id, source, input);
    else await fillFromTemplate(tx, created.id);

    const people = await tx
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.role, ["admin", "editor"])))
      .orderBy(asc(groupMembers.userId));
    if (people.length > 0) {
      await tx
        .insert(tripMembers)
        .values(people.map(({ userId }) => ({ tripId: created.id, userId, isShopper: userId === by })));
    }

    return { trip: { id: created.id } };
  });
}
