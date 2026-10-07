import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { findActiveUser } from "@/lib/user";
import type { User } from "@/db/schema";

/**
 * The signed-in person's row, re-read from the database on every call, and
 * null once they belong to no group (see findActiveUser).
 *
 * Who they are, not what they may do: permissions depend on which trip or
 * group a request is about, and live in lib/access.ts.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return findActiveUser(email);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Any signed-in person, for the few routes that are about the person rather
 * than a trip: notification preferences, push devices, onboarding.
 */
export async function requireSignedIn(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "לא מחובר");
  return user;
}

/**
 * The super admin, for /admin and /api/admin. Everyone else gets 403, group
 * admins included: they run their own group at /g/[groupId], not every group.
 */
export async function requireSuperAdmin(): Promise<User> {
  const user = await requireSignedIn();
  if (!user.isSuperAdmin) throw new HttpError(403, "רק למנהל המערכת");
  return user;
}

/**
 * The same, for pages. A valid session whose person belongs to no group any
 * more (removed from the last one) goes to /no-access rather than /login: the
 * login page bounces anyone with a session straight back here, which would
 * loop forever.
 */
export async function requirePageUser(): Promise<User> {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const user = await findActiveUser(session.user.email);
  if (!user) redirect("/no-access?error=AccessDenied");
  return user;
}

/** Wraps a handler so thrown HttpErrors become clean JSON responses. */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
