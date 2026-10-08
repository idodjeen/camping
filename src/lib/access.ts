import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  groupMembers,
  groups,
  trip,
  tripMembers,
  type Group,
  type MemberRole,
  type Trip,
  type User,
} from "@/db/schema";
import { HttpError, requireSignedIn } from "@/lib/session";

/**
 * What one person may do on one trip. Every trip page and trip API route
 * starts by loading this, and every query after it filters by `trip.id`.
 *
 * - read:  anyone in the trip's group (any role), or a super admin.
 * - write: editors who are on the trip, group admins, super admins.
 * - admin: group admins and super admins.
 */
export type TripAccess = {
  user: User;
  trip: Trip;
  /** Role in the trip's group; null for a super admin who is not a member. */
  role: MemberRole | null;
  /** On this trip's participant list (expenses, leaderboard, @all). */
  onTrip: boolean;
  isShopper: boolean;
  /** Group admin or super admin. */
  isAdmin: boolean;
  canWrite: boolean;
};

export type Level = "read" | "write" | "admin";

/** One round trip: the trip, plus the caller's group role and trip membership. */
export async function loadTripAccess(user: User, tripId: number): Promise<TripAccess | null> {
  if (!Number.isInteger(tripId) || tripId <= 0) return null;

  const [row] = await db
    .select({
      trip,
      role: groupMembers.role,
      memberId: tripMembers.userId,
      isShopper: tripMembers.isShopper,
    })
    .from(trip)
    .leftJoin(
      groupMembers,
      and(eq(groupMembers.groupId, trip.groupId), eq(groupMembers.userId, user.id)),
    )
    .leftJoin(tripMembers, and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, user.id)))
    .where(eq(trip.id, tripId));

  if (!row || (!row.role && !user.isSuperAdmin)) return null;

  const onTrip = row.memberId !== null;
  const isAdmin = user.isSuperAdmin || row.role === "admin";
  return {
    user,
    trip: row.trip,
    role: row.role,
    onTrip,
    isShopper: onTrip && Boolean(row.isShopper),
    isAdmin,
    canWrite: isAdmin || (row.role === "editor" && onTrip),
  };
}

export async function requireTrip(rawTripId: string | number, level: Level = "read") {
  const user = await requireSignedIn();
  const access = await loadTripAccess(user, Number(rawTripId));
  // 404 rather than 403: someone outside the group cannot even learn that the
  // trip exists, let alone what is in it.
  if (!access) throw new HttpError(404, "הטיול לא נמצא");

  if (level === "write" && !access.canWrite) {
    throw new HttpError(
      403,
      access.role === "viewer" ? "מצב צפייה בלבד" : "רק משתתפי הטיול יכולים לערוך",
    );
  }
  if (level === "admin" && !access.isAdmin) throw new HttpError(403, "רק מנהלי הקבוצה");
  return access;
}

/** The context Next passes to every handler under /api/t/[tripId]. */
export type TripParams = { params: Promise<{ tripId: string }> };

export async function tripRoute(ctx: TripParams, level: Level = "read") {
  return requireTrip((await ctx.params).tripId, level);
}

/**
 * What one person may do in one group, for the group admin's page. The same
 * shape as TripAccess, one level up.
 */
export type GroupAccess = {
  user: User;
  group: Group;
  /** Role in this group; null for a super admin who is not a member. */
  role: MemberRole | null;
  /** Group admin or super admin. */
  isAdmin: boolean;
};

/** One round trip: the group, plus the caller's role in it. */
export async function loadGroupAccess(user: User, groupId: number): Promise<GroupAccess | null> {
  if (!Number.isInteger(groupId) || groupId <= 0) return null;

  const [row] = await db
    .select({ group: groups, role: groupMembers.role })
    .from(groups)
    .leftJoin(
      groupMembers,
      and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, user.id)),
    )
    .where(eq(groups.id, groupId));

  if (!row || (!row.role && !user.isSuperAdmin)) return null;
  return { user, group: row.group, role: row.role, isAdmin: user.isSuperAdmin || row.role === "admin" };
}

/**
 * The gate for /g/[groupId] and /api/g/[groupId]: group admins of this group
 * and the super admin. Like requireTrip, anyone outside the group gets 404 so
 * they can't learn that it exists; members who aren't admins get 403.
 */
export async function requireGroupAdmin(rawGroupId: string | number) {
  const user = await requireSignedIn();
  const access = await loadGroupAccess(user, Number(rawGroupId));
  if (!access) throw new HttpError(404, "הקבוצה לא נמצאה");
  if (!access.isAdmin) throw new HttpError(403, "רק מנהלי הקבוצה");
  return access;
}

/** The context Next passes to every handler under /api/g/[groupId]. */
export type GroupParams = { params: Promise<{ groupId: string }> };

export async function groupRoute(ctx: GroupParams) {
  return requireGroupAdmin((await ctx.params).groupId);
}

/** A numeric path segment such as [id], or a 400. */
export function intParam(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "מזהה לא תקין");
  return n;
}
