import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { gearClaims, personalItems, users } from "@/db/schema";
import { unreadMentions } from "@/lib/comments";
import { prefsOf } from "@/lib/notifications";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const me = await requireUser();

    const claims = await db.query.gearClaims.findMany({
      where: eq(gearClaims.userId, me.id),
      with: { item: { with: { category: true } } },
    });

    // Scoped to the session user's id. The client never supplies a user id
    // anywhere in this file — that is the entire privacy guarantee for the
    // personal list.
    const personal = await db
      .select()
      .from(personalItems)
      .where(eq(personalItems.userId, me.id))
      .orderBy(asc(personalItems.sort), asc(personalItems.id));

    return {
      user: {
        id: me.id,
        name: me.name,
        slug: me.slug,
        avatarUrl: me.avatarUrl,
        isAdmin: me.isAdmin,
        isShopper: me.isShopper,
      },
      notify: prefsOf(me),
      claims: claims
        .map((c) => ({
          itemId: c.gearItemId,
          qty: c.qty,
          isPacked: c.isPacked,
          name: c.item.name,
          qtyLabel: c.item.qtyLabel,
          categoryName: c.item.category.name,
        }))
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName, "he")),
      personal,
      unreadMentions: await unreadMentions(me.id),
      // The five, for the @ picker. Small enough to ride along rather than
      // making the composer fetch a roster of its own.
      people: (await db.select().from(users).orderBy(asc(users.id))).map((u) => ({
        id: u.id,
        name: u.name,
        slug: u.slug,
        avatarUrl: u.avatarUrl,
      })),
    };
  });
}
