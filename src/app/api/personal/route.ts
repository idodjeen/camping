import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { personalItems } from "@/db/schema";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const body = (await req.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) throw new HttpError(400, "צריך שם לפריט");
    if (name.length > 120) throw new HttpError(400, "השם ארוך מדי");

    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${personalItems.sort}), -1) + 1` })
      .from(personalItems)
      .where(eq(personalItems.userId, me.id));

    const [created] = await db
      .insert(personalItems)
      // userId comes from the session, never from the request body.
      .values({ userId: me.id, name, sort: next })
      .returning();

    return { item: created };
  });
}
