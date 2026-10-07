import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { settlements } from "@/db/schema";
import { intParam, tripRoute } from "@/lib/access";
import { handle, HttpError } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tripId: string; id: string }> };

/** Undo a recorded payment (e.g. it was marked by mistake). */
export function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user: me, isAdmin } = await tripRoute(ctx, "write");
    const id = intParam((await ctx.params).id);
    const thisOne = and(eq(settlements.id, id), eq(settlements.tripId, trip.id));

    const [row] = await db.select().from(settlements).where(thisOne);
    if (!row) throw new HttpError(404, "התשלום לא נמצא");
    if (!isAdmin && row.createdBy !== me.id) {
      throw new HttpError(403, "אפשר לבטל רק תשלום שסימנת בעצמך");
    }

    await db.delete(settlements).where(thisOne);
    return { deleted: true };
  });
}
