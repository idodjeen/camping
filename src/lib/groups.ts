import { asc, count, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { groupMembers, groups, trip, users, type MemberRole } from "@/db/schema";
import { clashes, isEmail, nameProblem, type PersonInput } from "@/lib/people";
import { HttpError } from "@/lib/session";
import { createUser } from "@/lib/user";

export type GroupMemberRow = { userId: number; name: string; email: string; role: MemberRole };
export type GroupSummary = {
  id: number;
  name: string;
  createdAt: string;
  trips: number;
  members: GroupMemberRow[];
};

const ROLE_ORDER: Record<MemberRole, number> = { admin: 0, editor: 1, viewer: 2 };

/** Every group with its people and how many trips it has: the super admin's list. */
export async function listGroups(): Promise<GroupSummary[]> {
  const [rows, members, tripCounts] = await Promise.all([
    db.select().from(groups).orderBy(asc(groups.id)),
    db
      .select({
        groupId: groupMembers.groupId,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: groupMembers.role,
      })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId)),
    db.select({ groupId: trip.groupId, n: count() }).from(trip).groupBy(trip.groupId),
  ]);

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    createdAt: g.createdAt.toISOString(),
    trips: tripCounts.find((t) => t.groupId === g.id)?.n ?? 0,
    members: members
      .filter((m) => m.groupId === g.id)
      .map(({ groupId: _, ...m }) => m)
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, "he")),
  }));
}

export type NewGroup = {
  name: string;
  admin: PersonInput;
  editors: PersonInput[];
  viewers: PersonInput[];
};

const GROUP_NAME_MAX = 40;

/** The request body, checked field by field. Throws a 400 naming what to fix. */
export function parseNewGroup(raw: unknown): NewGroup {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const problems: string[] = [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) problems.push("חסר שם לקבוצה");
  else if ([...name].length > GROUP_NAME_MAX) problems.push(`שם הקבוצה עד ${GROUP_NAME_MAX} תווים`);

  const person = (v: unknown, where: string): PersonInput | null => {
    const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const email = typeof p.email === "string" ? p.email.trim().toLowerCase() : "";
    const pname = typeof p.name === "string" ? p.name.trim() : "";
    if (!isEmail(email)) {
      problems.push(`${where}: המייל ${email || "(ריק)"} לא תקין`);
      return null;
    }
    const bad = nameProblem(pname);
    if (bad) {
      problems.push(`${where} (${email}): ${bad}`);
      return null;
    }
    return { email, name: pname };
  };
  const list = (v: unknown, where: string) =>
    (Array.isArray(v) ? v : []).map((p) => person(p, where)).filter((p): p is PersonInput => p !== null);

  const admin = person(body.admin, "מנהל/ת");
  const editors = list(body.editors, "חברים");
  const viewers = list(body.viewers, "צפייה");

  if (problems.length > 0 || !admin) throw new HttpError(400, problems.join("\n") || "חסר מנהל/ת");
  return { name, admin, editors, viewers };
}

/**
 * Creates a group with its first admin, editors and viewers, all at once.
 *
 * People are matched by email. Someone who already has a row keeps their name
 * (a person has one name everywhere) and their other groups; anyone new gets
 * a row here, which is also what lets them sign in. Names must be unique
 * within the group, because @mentions match by name. The checks run again
 * inside the transaction against the real rows, since what the form showed
 * may be stale.
 */
export async function createGroup(input: NewGroup, by: number) {
  const roles: [PersonInput, MemberRole][] = [
    [input.admin, "admin"],
    ...input.editors.map((p): [PersonInput, MemberRole] => [p, "editor"]),
    ...input.viewers.map((p): [PersonInput, MemberRole] => [p, "viewer"]),
  ];

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(users)
      .where(inArray(users.email, roles.map(([p]) => p.email)));
    const byEmail = new Map(existing.map((u) => [u.email, u]));

    // The name each person will actually have in the group.
    const effective = roles.map(([p]) => ({ email: p.email, name: byEmail.get(p.email)?.name ?? p.name }));
    const problems = clashes(effective);
    if (problems.length > 0) throw new HttpError(400, problems.join("\n"));

    const [group] = await tx.insert(groups).values({ name: input.name, createdBy: by }).returning();

    const kept: { email: string; typed: string; name: string }[] = [];
    for (const [p, role] of roles) {
      const found = byEmail.get(p.email);
      if (found && found.name !== p.name) kept.push({ email: p.email, typed: p.name, name: found.name });
      const user = found ?? (await createUser(tx, p));
      await tx.insert(groupMembers).values({ groupId: group.id, userId: user.id, role, addedBy: by });
    }

    return { group: { id: group.id, name: group.name }, kept };
  });
}
