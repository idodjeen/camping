import { eq } from "drizzle-orm";

import { db } from "@/db";
import { gearCategories, gearItems } from "@/db/schema";
import { getGear } from "@/lib/queries";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const me = await requireUser();
    // The viewer is the session user, so "unread" can only ever mean mine.
    return { categories: await getGear(me.id) };
  });
}

/** Any member may add a gear item — the group is five friends, not an org. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
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
      .where(eq(gearCategories.id, body.categoryId));
    if (!category) throw new HttpError(404, "קטגוריה לא נמצאה");

    const qty = body.qtyNeeded ?? 1;
    try {
      const [created] = await db
        .insert(gearItems)
        .values({
          categoryId: category.id,
          name,
          qtyNeeded: Math.max(1, Math.min(qty, 99)),
          isOptional: body.isOptional ?? false,
          createdBy: me.id,
        })
        .returning();
      return { item: created };
    } catch {
      // UNIQUE(category_id, name)
      throw new HttpError(409, "כבר יש פריט כזה בקטגוריה");
    }
  });
}
