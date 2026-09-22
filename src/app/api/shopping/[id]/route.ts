import { eq } from "drizzle-orm";

import { db } from "@/db";
import { shoppingItems } from "@/db/schema";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Mark an item bought / not bought.
 *
 * Only עידו and ניר (is_shopper) may do this. The check lives here rather than
 * in the UI: hiding the checkbox stops honest mistakes, this stops everything
 * else. `is_shopper` is read fresh from the database per request, so revoking
 * it takes effect immediately.
 */
export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    if (!me.isShopper) throw new HttpError(403, "רק עידו וניר מסמנים קניות");

    const id = Number((await params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");

    const body = (await req.json()) as { isBought?: boolean };
    const isBought = Boolean(body.isBought);

    const [updated] = await db
      .update(shoppingItems)
      .set({
        isBought,
        boughtBy: isBought ? me.id : null,
        boughtAt: isBought ? new Date() : null,
      })
      .where(eq(shoppingItems.id, id))
      .returning();
    if (!updated) throw new HttpError(404, "הפריט לא נמצא");

    return { item: updated };
  });
}
