import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { personalItems } from "@/db/schema";
import { tripRoute, type TripParams } from "@/lib/access";
import { handle, HttpError } from "@/lib/session";

export const dynamic = "force-dynamic";

export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user } = await tripRoute(ctx, "write");
    const body = (await req.json()) as { name?: string; names?: string[] };
    // `names` bulk-adds (used by the suggested list); `name` adds one item.
    const names = (Array.isArray(body.names) ? body.names : [body.name ?? ""])
      .map((n) => (typeof n === "string" ? n.trim() : ""))
      .filter(Boolean);
    if (names.length === 0) throw new HttpError(400, "צריך שם לפריט");
    if (names.length > 50) throw new HttpError(400, "יותר מדי פריטים");
    if (names.some((n) => n.length > 120)) throw new HttpError(400, "השם ארוך מדי");

    const mine = and(eq(personalItems.userId, user.id), eq(personalItems.tripId, trip.id));
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${personalItems.sort}), -1) + 1` })
      .from(personalItems)
      .where(mine);

    const created = await db
      .insert(personalItems)
      // userId comes from the session, never from the request body.
      .values(
        names.map((name, i) => ({
          tripId: trip.id,
          userId: user.id,
          name,
          sort: Number(next) + i,
        })),
      )
      .returning();

    return { item: created[0], items: created };
  });
}
