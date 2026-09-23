import { eq } from "drizzle-orm";

import { db } from "@/db";
import { shoppingCategories, shoppingItems } from "@/db/schema";
import { getShopping } from "@/lib/queries";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const me = await requireUser();
    // canBuy drives whether the client renders checkboxes. The PATCH handler
    // re-checks it server-side — this is presentation only, never permission.
    return { categories: await getShopping(), canBuy: me.isShopper };
  });
}

/**
 * Add an item to the shopping list.
 *
 * Open to every member, mirroring gear: noticing something is missing is not a
 * privileged act. Only *buying* stays restricted to `is_shopper`, which is the
 * permission that actually matters.
 */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
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
      .where(eq(shoppingCategories.id, body.categoryId));
    if (!category) throw new HttpError(404, "קטגוריה לא נמצאה");

    try {
      const [created] = await db
        .insert(shoppingItems)
        .values({
          categoryId: category.id,
          name,
          quantityText: body.quantityText?.trim() || null,
          createdBy: me.id,
        })
        .returning();
      return { item: created };
    } catch {
      // Unlike gear_items, which is unique per (category_id, name),
      // shopping_items.name is unique GLOBALLY — so the same name under a
      // different category still collides. Say so plainly instead of 500ing.
      throw new HttpError(409, "כבר יש פריט כזה ברשימה");
    }
  });
}
