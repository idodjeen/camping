import Link from "next/link";

import { formatShortDate } from "@/lib/dates";
import { requirePageUser } from "@/lib/session";
import { accessibleTrips } from "@/lib/trips";

/**
 * Every trip you can open, by group. A stand-in until the header's trip
 * switcher (groups phase 3); reachable from the profile screen.
 */
export default async function TripsPage() {
  const user = await requirePageUser();
  const trips = await accessibleTrips(user);

  const byGroup = new Map<string, typeof trips>();
  for (const t of trips) byGroup.set(t.groupName, [...(byGroup.get(t.groupName) ?? []), t]);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-7 pb-10">
      <h1 className="mb-6 text-2xl font-bold">הטיולים שלי</h1>

      {trips.length === 0 && (
        <p className="glass rounded-glass p-4 text-sm text-white/70">
          עוד לא הוסיפו אותך לאף טיול. מי שמנהל את הקבוצה יכול להוסיף אותך.
        </p>
      )}

      {[...byGroup].map(([groupName, list]) => (
        <section key={groupName} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-white/50">{groupName}</h2>
          <ul className="space-y-2">
            {list.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/t/${t.id}`}
                  className="glass block rounded-glass p-4 transition active:scale-[0.99]"
                >
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    {/* dir=ltr keeps the range in date order inside RTL text. */}
                    <span dir="ltr">
                      {formatShortDate(t.startDate)} – {formatShortDate(t.endDate)}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
