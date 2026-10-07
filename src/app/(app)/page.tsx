import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LAST_TRIP_COOKIE } from "@/lib/last-trip";
import { requirePageUser } from "@/lib/session";
import { accessibleTrips } from "@/lib/trips";

/**
 * `/` opens the trip you were last in, or your only trip. With several trips
 * and no remembered one, you choose.
 */
export default async function Home() {
  const user = await requirePageUser();
  const trips = await accessibleTrips(user);

  const last = Number((await cookies()).get(LAST_TRIP_COOKIE)?.value);
  const target = trips.find((t) => t.id === last) ?? (trips.length === 1 ? trips[0] : null);
  redirect(target ? `/t/${target.id}` : "/trips");
}
