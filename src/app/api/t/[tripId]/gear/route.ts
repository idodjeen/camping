import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { gearCategories, gearItems } from "@/db/schema";
import { tripRoute, type TripParams } from "@/lib/access";
import { notify } from "@/lib/notifications";
import { getGear } from "@/lib/queries";
import { handle, HttpError } from "@/lib/session";
import { THREAD } from "@/lib/threads";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx);
    // The viewer is the session user, so "unread" can only ever mean mine.
    return { categories: await getGear(trip.id, user.id) };
  });
}

/** Anyone who can edit the trip may add a gear item. */
export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const body = (await req.json()) as {
      categoryId?: number;
      name?: string;
      qtyNeeded?: number | null;
      isOptional?: boolean;
    };

    const name = body.name?.trim();
    if (!name) throw new HttpError(400, "צריך שם לפריט");
    if (!body.categoryId) throw new HttpError(400, "צריך לבחור קטגוריה");

    const [category] = await db
      .select()
      .from(gearCategories)
      .where(and(eq(gearCategories.id, body.categoryId), eq(gearCategories.tripId, trip.id)));
    if (!category) throw new HttpError(404, "קטגוריה לא נמצאה");

    const qty = body.qtyNeeded ?? 1;
    let created;
    try {
      [created] = await db
        .insert(gearItems)
        .values({
          tripId: trip.id,
          categoryId: category.id,
          name,
          qtyNeeded: Math.max(1, Math.min(qty, 99)),
          isOptional: body.isOptional ?? false,
          createdBy: user.id,
        })
        .returning();
    } catch {
      // UNIQUE(category_id, name)
      throw new HttpError(409, "כבר יש פריט כזה בקטגוריה");
    }

    await notify({
      tripId: trip.id,
      kind: "gear_added",
      actorId: user.id,
      thread: THREAD.list("gear"),
      refs: { gearItemId: created.id },
      data: { name: created.name },
      push: { label: "ציוד" },
    });
    return { item: created };
  });
}
