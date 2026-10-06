import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isViewer, viewerNameFor } from "@/lib/allowlist";
import { getOrCreateUser } from "@/lib/user";
import type { User } from "@/db/schema";

/**
 * The current user, re-read from the database on every call so role changes
 * (admin / shopper) apply immediately rather than being frozen into the JWT.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  if (isViewer(email)) {
    const name = viewerNameFor(email) ?? email.split("@")[0];
    // id 0 matches no row, so every "mine" query (claims, unread, notifications)
    // comes back empty for a viewer instead of needing a special case.
    return {
      id: 0,
      email: email.toLowerCase(),
      name,
      slug: "viewer",
      avatarUrl: null,
      isAdmin: false,
      isShopper: false,
      isSuperAdmin: false,
      onboardedAt: new Date(0),
      notifyMentions: false,
      notifyCovered: false,
      notifyMessages: false,
      createdAt: new Date(0),
      isViewer: true,
    };
  }

  return { ...(await getOrCreateUser(email)), isViewer: false };
}

/** A member's row, or a synthetic read-only stand-in for a viewer. */
export type SessionUser = User & { isViewer: boolean };

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Any signed-in person, viewers included. Only for handlers that never change
 * anything — every GET that just reads.
 */
export async function requireReader(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "לא מחובר");
  return user;
}

/**
 * A full member. Use at the top of every handler that writes: viewers get a
 * 403 here, so read-only is enforced on the server, not just hidden in the UI.
 */
export async function requireUser(): Promise<User> {
  const user = await requireReader();
  if (user.isViewer) throw new HttpError(403, "מצב צפייה בלבד");
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
