import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { ROSTER } from "@/db/seed-data";
import { displayNameFor } from "@/lib/allowlist";

/**
 * Links a Google account to its row in `users`.
 *
 * Normally the row already exists (the seed creates all five from
 * ALLOWED_USERS). This also handles the case where someone is added to the
 * allowlist and logs in before the seed is re-run — they get a member-level
 * row rather than a 500.
 *
 * Roles are read from the DB and never written here: a login must not be able
 * to grant itself admin.
 */
export async function getOrCreateUser(rawEmail: string) {
  const email = rawEmail.toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return existing;

  const name = displayNameFor(email) ?? email.split("@")[0];
  const role = ROSTER[name];
  const slug = role?.slug ?? email.split("@")[0].replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  const [created] = await db
    .insert(users)
    .values({
      email,
      name,
      slug,
      avatarUrl: `/avatars/${slug}.jpg`,
      isAdmin: role?.isAdmin ?? false,
      isShopper: role?.isShopper ?? false,
    })
    .onConflictDoUpdate({ target: users.email, set: { name } })
    .returning();

  return created;
}
