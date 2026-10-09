import { eq, or, sql } from "drizzle-orm";

import { db, type Tx } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { cleanEmail, gmailKey } from "@/lib/people";

/** gmailKey() of the stored email, in SQL; null for non-Gmail rows. */
const STORED_GMAIL_KEY = sql`case when split_part(${users.email}, '@', 2) in ('gmail.com', 'googlemail.com')
  then replace(split_part(split_part(${users.email}, '@', 1), '+', 1), '.', '') || '@gmail.com' end`;

/**
 * Which row an email signs in as. The exact address wins; failing that, a
 * Gmail address matches a row typed with other dots, a "+" tag or
 * googlemail.com, since Google hands us the account's own spelling and not
 * the one the group admin typed. The users table is small, so the fallback's
 * scan costs nothing.
 */
function byEmail(rawEmail: string) {
  const email = cleanEmail(rawEmail);
  const key = gmailKey(email);
  return {
    where: key ? or(eq(users.email, email), sql`${STORED_GMAIL_KEY} = ${key}`) : eq(users.email, email),
    order: [sql`${users.email} = ${email} desc`, users.id],
  };
}

export async function findUserByEmail(rawEmail: string) {
  const { where, order } = byEmail(rawEmail);
  const [row] = await db.select().from(users).where(where).orderBy(...order).limit(1);
  return row ?? null;
}

/**
 * The person behind a session, but only while they still belong somewhere:
 * the super admin, or a member of at least one group. One query.
 *
 * Sessions last 30 days, so this is what makes a removal take effect on the
 * very next request: someone removed from their last group has a valid
 * cookie but no longer counts as signed in (401 from the API, /no-access on
 * pages), exactly like canSignIn would answer for a fresh sign-in.
 */
export async function findActiveUser(rawEmail: string) {
  const { where, order } = byEmail(rawEmail);
  const [row] = await db
    .select({
      user: users,
      member: sql<boolean>`exists (select 1 from ${groupMembers} where ${groupMembers.userId} = ${users.id})`,
    })
    .from(users)
    .where(where)
    .orderBy(...order)
    .limit(1);
  if (!row) return null;
  return row.user.isSuperAdmin || row.member ? row.user : null;
}

/**
 * The sign-in gate: a super admin, or anyone who belongs to at least one group.
 *
 * Rows are created by whoever adds a person to a group, never by signing in,
 * so a Google account nobody invited has no row and is turned away.
 */
export async function canSignIn(rawEmail: string): Promise<boolean> {
  const email = cleanEmail(rawEmail);
  const user = await findUserByEmail(email);

  if (!user) return false;
  if (user.isSuperAdmin) return true;

  const [membership] = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, user.id))
    .limit(1);
  return Boolean(membership);
}

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
