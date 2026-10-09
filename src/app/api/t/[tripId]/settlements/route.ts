import { db } from "@/db";
import { settlements } from "@/db/schema";
import { tripRoute, type TripParams } from "@/lib/access";
import { notify } from "@/lib/notifications";
import { handle, HttpError } from "@/lib/session";
import { THREAD } from "@/lib/threads";
import { tripPeople } from "@/lib/trips";

export const dynamic = "force-dynamic";

const MAX_AMOUNT = 10_000_000;

/** Record that `from` paid `to` back, outside the app (cash, Bit, PayBox…). */
export function POST(req: Request, ctx: TripParams) {
  return handle(async () => {
    const { trip, user: me } = await tripRoute(ctx, "write");
    const body = (await req.json()) as { from?: number; to?: number; amount?: number };

    const { from, to, amount } = body;
    if (!Number.isInteger(from) || !Number.isInteger(to)) throw new HttpError(400, "חסרים משתתפים");
    if (from === to) throw new HttpError(400, "אי אפשר לשלם לעצמך");
    if (!Number.isInteger(amount) || amount! < 1 || amount! > MAX_AMOUNT) {
      throw new HttpError(400, "סכום לא תקין");
    }

    // Both sides must be on this trip.
    const onTrip = new Map((await tripPeople(trip.id)).map((p) => [p.id, p.name]));
    if (!onTrip.has(from!) || !onTrip.has(to!)) throw new HttpError(400, "אחד המשתתפים לא נמצא");

    const [created] = await db
      .insert(settlements)
      .values({ tripId: trip.id, fromUser: from!, toUser: to!, amount: amount!, createdBy: me.id })
      .returning();

    // Undoing a payment deletes it, and this row with it: there's no "undone".
    await notify({
      tripId: trip.id,
      kind: "settlement",
      actorId: me.id,
      thread: THREAD.money,
      to: [from!, to!],
      refs: { settlementId: created.id },
      data: { from, to, fromName: onTrip.get(from!), toName: onTrip.get(to!), amount },
      push: { label: "כסף" },
    });
    return { settlement: created };
  });
}
