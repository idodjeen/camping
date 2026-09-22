import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { gearClaims } from "@/db/schema";
import { setClaim } from "@/lib/gear";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const itemId = Number((await params).id);
    if (!Number.isInteger(itemId)) throw new HttpError(400, "מזהה לא תקין");

    const body = (await req.json()) as { qty?: number };
    // qty of 0 or less means "release" - simpler for the client than a separate
    // endpoint, and it makes the stepper's last decrement natural.
    return setClaim(me.id, itemId, Math.floor(body.qty ?? 1));
  });
}

/** Toggle the "packed" flag on my own claim. */
export function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const itemId = Number((await params).id);
    const body = (await req.json()) as { isPacked?: boolean };

    const [updated] = await db
      .update(gearClaims)
      .set({ isPacked: Boolean(body.isPacked) })
      .where(and(eq(gearClaims.gearItemId, itemId), eq(gearClaims.userId, me.id)))
      .returning();
    if (!updated) throw new HttpError(404, "לא מצאנו את ההתחייבות שלך");
    return { claim: updated };
  });
}

export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const itemId = Number((await params).id);
    await db
      .delete(gearClaims)
      .where(and(eq(gearClaims.gearItemId, itemId), eq(gearClaims.userId, me.id)));
    return { released: true };
  });
}
