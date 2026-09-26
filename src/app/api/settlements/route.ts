import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { settlements, users } from "@/db/schema";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_AMOUNT = 10_000_000;

/** Record that `from` paid `to` back, outside the app (cash, Bit, PayBox…). */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const body = (await req.json()) as { from?: number; to?: number; amount?: number };

    const { from, to, amount } = body;
    if (!Number.isInteger(from) || !Number.isInteger(to)) throw new HttpError(400, "חסרים משתתפים");
    if (from === to) throw new HttpError(400, "אי אפשר לשלם לעצמך");
    if (!Number.isInteger(amount) || amount! < 1 || amount! > MAX_AMOUNT) {
      throw new HttpError(400, "סכום לא תקין");
    }

    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, [from!, to!]));
    if (found.length !== 2) throw new HttpError(400, "אחד המשתתפים לא נמצא");

    const [created] = await db
      .insert(settlements)
      .values({ fromUser: from!, toUser: to!, amount: amount!, createdBy: me.id })
      .returning();
    return { settlement: created };
  });
}
