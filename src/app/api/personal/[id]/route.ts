import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { personalItems } from "@/db/schema";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Every query here is scoped by BOTH the row id and the session user's id.
 * Matching on id alone would let anyone edit or delete another person's
 * private list by guessing a number.
 */
export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const id = Number((await params).id);
    const body = (await req.json()) as { name?: string; isPacked?: boolean };

    const patch: { name?: string; isPacked?: boolean } = {};
    if (typeof body.isPacked === "boolean") patch.isPacked = body.isPacked;
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) throw new HttpError(400, "צריך שם לפריט");
      patch.name = name;
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, "אין מה לעדכן");

    const [updated] = await db
      .update(personalItems)
      .set(patch)
      .where(and(eq(personalItems.id, id), eq(personalItems.userId, me.id)))
      .returning();
    if (!updated) throw new HttpError(404, "הפריט לא נמצא");
    return { item: updated };
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const id = Number((await params).id);
    const [deleted] = await db
      .delete(personalItems)
      .where(and(eq(personalItems.id, id), eq(personalItems.userId, me.id)))
      .returning();
    if (!deleted) throw new HttpError(404, "הפריט לא נמצא");
    return { deleted: true };
  });
}
