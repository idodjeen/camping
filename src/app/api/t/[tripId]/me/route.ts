import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { gearClaims, personalItems } from "@/db/schema";
import { tripRoute, type TripParams } from "@/lib/access";
import { legacyUnreadMentions, prefsOf } from "@/lib/notifications";
import { handle } from "@/lib/session";
import { tripPeople } from "@/lib/trips";

export const dynamic = "force-dynamic";

/** Me, on this trip: my role here, my claims and list, and the trip's people. */
export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const access = await tripRoute(ctx);
    const { trip, user: me } = access;

    const claims = await db.query.gearClaims.findMany({
      where: eq(gearClaims.userId, me.id),
      with: { item: { with: { category: true } } },
    });

    // Scoped to the session user's id. The client never supplies a user id
    // anywhere in this file; that is the entire privacy guarantee for the
    // personal list.
    const personal = await db
      .select()
      .from(personalItems)
      .where(and(eq(personalItems.userId, me.id), eq(personalItems.tripId, trip.id)))
      .orderBy(asc(personalItems.sort), asc(personalItems.id));

    return {
      user: {
        id: me.id,
        name: me.name,
        slug: me.slug,
        avatarUrl: me.avatarUrl,
        isAdmin: access.isAdmin,
        isShopper: access.isShopper,
        isSuperAdmin: me.isSuperAdmin,
        // Read-only here: a viewer, or a group member who is not on this trip.
        isViewer: !access.canWrite,
      },
      notify: prefsOf(me),
      claims: claims
        .filter((c) => c.item.tripId === trip.id)
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
      // ADAPTER for one release, removed in H: the nav now counts from /inbox.
      unreadMentions: await legacyUnreadMentions(me.id, trip.id),
      // The trip's people, for the @ picker. Small enough to ride along rather
      // than making the composer fetch a roster of its own.
      people: (await tripPeople(trip.id)).map((u) => ({
        id: u.id,
        name: u.name,
        slug: u.slug,
        avatarUrl: u.avatarUrl,
      })),
    };
  });
}
