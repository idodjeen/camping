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
    const row = await createUser(tx, { email, name: viewer.name });
    await tx
      .insert(groupMembers)
      .values({ groupId: ORIGINAL_GROUP_ID, userId: row.id, role: "viewer" })
      .onConflictDoNothing();
  });

  console.info(`imported VIEWER_USERS entry as a viewer of group ${ORIGINAL_GROUP_ID}`);
  return true;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A new person's row, with a slug no one else has.
 *
 * The slug is the email's local part in Latin letters ("dana.levi" ->
 * "dana-levi"), with the first free "-2", "-3" on a clash: `users.slug` is
 * unique, so two "dana@" addresses would otherwise fail the second insert.
 * When the local part has no Latin letter at all ("0541234567@..."), it's
 * "user-<id>" instead. No avatar: the five photos in /public/avatars are the
 * founders', and everyone else gets the gradient initial.
 *
 * If the email already has a row (two inserts racing), that row comes back
 * unchanged, name included: a person has one name everywhere.
 */
export async function createUser(tx: Tx, { email, name }: { email: string; name: string }) {
  const [{ id }] = (
    await tx.execute<{ id: number }>(sql`select nextval(pg_get_serial_sequence('users', 'id'))::int as id`)
  ).rows;

  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let slug = /[a-z]/.test(base) ? base : `user-${id}`;

  const taken = new Set(
    (
      await tx
        .select({ slug: users.slug })
        .from(users)
        .where(sql`${users.slug} = ${slug} or ${users.slug} like ${slug + "-%"}`)
    ).map((r) => r.slug),
  );
  for (let n = 2, root = slug; taken.has(slug); n++) slug = `${root}-${n}`;

  const [row] = await tx
    .insert(users)
    .values({ id, email: email.toLowerCase(), name: name.trim(), slug })
    // Updating email to itself is a no-op that still returns the existing row.
    .onConflictDoUpdate({ target: users.email, set: { email: sql`excluded.email` } })
    .returning();
  return row;
}
