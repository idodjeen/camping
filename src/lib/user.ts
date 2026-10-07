import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { envViewer } from "@/lib/allowlist";

export async function findUserByEmail(rawEmail: string) {
  const [row] = await db.select().from(users).where(eq(users.email, rawEmail.toLowerCase()));
  return row ?? null;
}

/**
 * The sign-in gate: a super admin, or anyone who belongs to at least one group.
 *
 * Rows are created by whoever adds a person to a group, never by signing in,
 * so a Google account nobody invited has no row and is turned away. The one
 * exception is the transitional VIEWER_USERS import below.
 */
export async function canSignIn(rawEmail: string): Promise<boolean> {
  const email = rawEmail.toLowerCase();
  const user = await findUserByEmail(email);

  if (!user) return importEnvViewer(email);
  if (user.isSuperAdmin) return true;

  const [membership] = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, user.id))
    .limit(1);
  return Boolean(membership);
}

/**
 * The group VIEWER_USERS always meant: the original one, from before groups.
 * Hard-coded because the import is temporary (phase 7 removes it).
 */
const ORIGINAL_GROUP_ID = 1;

/**
 * First sign-in of someone on VIEWER_USERS: give them a row and make them a
 * viewer of the original group.
 *
 * Only when they have no row at all. Once imported, the database is the truth:
 * if a group admin later removes them, signing in again must not bring them
 * back just because the env var still lists them.
 */
async function importEnvViewer(email: string): Promise<boolean> {
  const viewer = envViewer(email);
  if (!viewer) return false;

  await db.transaction(async (tx) => {
    const base = email.split("@")[0].replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "guest";
    // Slugs are globally unique; the first free numeric suffix settles a clash.
    const taken = new Set(
      (
        await tx
          .select({ slug: users.slug })
          .from(users)
          .where(sql`${users.slug} = ${base} or ${users.slug} like ${base + "-%"}`)
      ).map((r) => r.slug),
    );
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

    const [row] = await tx
      .insert(users)
      .values({ email, name: viewer.name, slug, avatarUrl: `/avatars/${slug}.jpg` })
      // Two first sign-ins racing: the loser simply reuses the winner's row.
      .onConflictDoUpdate({ target: users.email, set: { email } })
      .returning({ id: users.id });

    await tx
      .insert(groupMembers)
      .values({ groupId: ORIGINAL_GROUP_ID, userId: row.id, role: "viewer" })
      .onConflictDoNothing();
  });

  console.info(`imported VIEWER_USERS entry as a viewer of group ${ORIGINAL_GROUP_ID}`);
  return true;
}
