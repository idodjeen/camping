import { eq } from "drizzle-orm";

import { db } from "@/db";
import { expenses } from "@/db/schema";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Whoever entered it, whoever paid, or an admin. Shares cascade with the row,
 * and balances are derived from what remains, so nothing else needs fixing up.
 */
export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const id = Number((await params).id);

    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!expense) throw new HttpError(404, "ההוצאה לא נמצאה");
    if (!me.isAdmin && expense.createdBy !== me.id && expense.paidBy !== me.id) {
      throw new HttpError(403, "אפשר למחוק רק הוצאה שהוספת או ששילמת");
    }

    await db.delete(expenses).where(eq(expenses.id, id));
    return { deleted: true };
  });
}
