import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { groupMembers, groups, trip, tripMembers, users, type User } from "@/db/schema";
import { LAST_TRIP_COOKIE } from "@/lib/last-trip";

/** A trip participant: the user row, plus whether they do the shopping on this trip. */
export type TripPerson = User & { isShopper: boolean };

/**
 * Who is on a trip. These are the people expenses are split between, the
 * leaderboard ranks, @mentions resolve against, and notifications reach.
 * Viewers and group members who skipped this trip are not in it.
 */
export async function tripPeople(tripId: number): Promise<TripPerson[]> {
  const rows = await db
    .select({ user: users, isShopper: tripMembers.isShopper })
    .from(tripMembers)
    .innerJoin(users, eq(users.id, tripMembers.userId))
    .where(eq(tripMembers.tripId, tripId))
    .orderBy(asc(users.id));
  return rows.map((r) => ({ ...r.user, isShopper: r.isShopper }));
}

/** Every trip this person can open, newest first. A super admin sees them all. */
export async function accessibleTrips(user: User) {
  const myGroups = db
    .select({ id: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, user.id));

  return db
    .select({
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      groupId: groups.id,
      groupName: groups.name,
    })
    .from(trip)
    .innerJoin(groups, eq(groups.id, trip.groupId))
    .where(user.isSuperAdmin ? undefined : inArray(trip.groupId, myGroups))
    .orderBy(desc(trip.startDate), desc(trip.id));
}

/**
 * The groups this person is in, with their role there. A super admin sees
 * every group, with a null role where they aren't a member.
 */
export async function accessibleGroups(user: User) {
  return db
    .select({ id: groups.id, name: groups.name, role: groupMembers.role })
    .from(groups)
    .leftJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, user.id)))
    .where(user.isSuperAdmin ? undefined : isNotNull(groupMembers.userId))
    .orderBy(asc(groups.id));
}

/**
 * Where "home" is: the last trip opened if it is still accessible, otherwise
 * the newest one. Null when the person has no trips at all.
 */
export async function homeTripId(user: User): Promise<number | null> {
  const trips = await accessibleTrips(user);
  if (trips.length === 0) return null;
  const last = Number((await cookies()).get(LAST_TRIP_COOKIE)?.value);
  return trips.find((t) => t.id === last)?.id ?? trips[0].id;
}
