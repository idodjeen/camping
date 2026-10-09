import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { shoppingCategories, shoppingItems } from "@/db/schema";
import { tripRoute, type TripParams } from "@/lib/access";
import { getShopping } from "@/lib/queries";
import { handle, HttpError } from "@/lib/session";
import { tripPeople } from "@/lib/trips";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user, isShopper } = await tripRoute(ctx);
    const [categories, people] = await Promise.all([getShopping(trip.id, user.id), tripPeople(trip.id)]);
    return {
      categories,
      // canBuy drives whether the client renders checkboxes. The PATCH handler
      // re-checks it server-side; this is presentation only, never permission.
      canBuy: isShopper,
      // Named on the screen for everyone else: who to ask about a purchase.
      shoppers: people.filter((p) => p.isShopper).map((p) => p.name),
    };
  });
}

/**
 * Add an item to the shopping list.
 *
 * Open to everyone who can edit the trip, mirroring gear: noticing something is
 * missing is not a privileged act. Only *buying* stays restricted to the trip's
 * shoppers, which is the permission that actually matters.
 */
export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const body = (await req.json()) as {
      categoryId?: number;
      name?: string;
      quantityText?: string;
    };

    const name = body.name?.trim();
    if (!name) throw new HttpError(400, "צריך שם לפריט");
    if (name.length > 80) throw new HttpError(400, "השם ארוך מדי");
    if (!body.categoryId) throw new HttpError(400, "צריך לבחור קטגוריה");

    const [category] = await db
      .select()
      .from(shoppingCategories)
      .where(
        and(eq(shoppingCategories.id, body.categoryId), eq(shoppingCategories.tripId, trip.id)),
      );
    if (!category) throw new HttpError(404, "קטגוריה לא נמצאה");

    try {
      const [created] = await db
        .insert(shoppingItems)
        .values({
          tripId: trip.id,
          categoryId: category.id,
          name,
          quantityText: body.quantityText?.trim() || null,
          createdBy: user.id,
        })
        .returning();
      return { item: created };
    } catch {
      // Unlike gear_items, which is unique per (category_id, name), a shopping
      // item's name is unique across the whole trip, so the same name under a
      // different category still collides. Say so plainly instead of 500ing.
      throw new HttpError(409, "כבר יש פריט כזה ברשימה");
    }
  });
}
