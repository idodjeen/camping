import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOrCreateUser } from "@/lib/user";
import type { User } from "@/db/schema";

/**
 * The current user, re-read from the database on every call so role changes
 * (admin / shopper) apply immediately rather than being frozen into the JWT.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  return getOrCreateUser(session.user.email);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Throws a 401 if unauthenticated. Use at the top of every route handler. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "לא מחובר");
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
