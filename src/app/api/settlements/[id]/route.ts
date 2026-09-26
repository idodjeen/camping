import { eq } from "drizzle-orm";

import { db } from "@/db";
import { settlements } from "@/db/schema";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Undo a recorded payment (e.g. it was marked by mistake). */
export function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const id = Number((await params).id);

    const [row] = await db.select().from(settlements).where(eq(settlements.id, id));
    if (!row) throw new HttpError(404, "התשלום לא נמצא");
    if (!me.isAdmin && row.createdBy !== me.id) {
      throw new HttpError(403, "אפשר לבטל רק תשלום שסימנת בעצמך");
    }

    await db.delete(settlements).where(eq(settlements.id, id));
    return { deleted: true };
  });
}
