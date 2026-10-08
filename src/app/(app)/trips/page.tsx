import { UserCog } from "lucide-react";
import Link from "next/link";

import { formatShortDate } from "@/lib/dates";
import { requirePageUser } from "@/lib/session";
import { accessibleGroups, accessibleTrips } from "@/lib/trips";

/**
 * Every trip you can open, by group. Where `/` lands when there are several
 * trips and none remembered; inside a trip, the header's switcher does this.
 *
 * Groups with no trip yet are listed too. For their admin that is the way in
 * to create the first one; everyone else learns it's on its way.
 */
export default async function TripsPage() {
  const user = await requirePageUser();
  const [trips, groups] = await Promise.all([accessibleTrips(user), accessibleGroups(user)]);

  // Groups in the order of their newest trip, then the ones without a trip.
  const byGroup = new Map<number, typeof trips>();
  for (const t of trips) byGroup.set(t.groupId, [...(byGroup.get(t.groupId) ?? []), t]);
  for (const g of groups) if (!byGroup.has(g.id)) byGroup.set(g.id, []);
  const groupOf = new Map(groups.map((g) => [g.id, g]));

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-7 pb-10">
      <h1 className="mb-6 text-2xl font-bold">הטיולים שלי</h1>

      {byGroup.size === 0 && (
        <p className="glass rounded-glass p-4 text-sm text-white/70">
          עוד לא הוסיפו אותך לאף טיול. מי שמנהל את הקבוצה יכול להוסיף אותך.
        </p>
      )}

      {[...byGroup].map(([groupId, list]) => {
        const group = groupOf.get(groupId);
        const isAdmin = user.isSuperAdmin || group?.role === "admin";
        return (
          <section key={groupId} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="flex-1 text-sm font-semibold text-white/50">
                {group?.name ?? list[0]?.groupName}
              </h2>
              {isAdmin && (
                <Link
                  href={`/g/${groupId}`}
                  className="tap -me-2 inline-flex items-center gap-1 rounded-xl px-2 text-xs font-semibold text-brand-300"
                >
                  <UserCog className="size-3.5" />
                  ניהול הקבוצה
                </Link>
              )}
            </div>

            {list.length === 0 ? (
              <div className="glass rounded-glass p-4 text-sm text-white/70">
                {isAdmin ? (
                  <>
                    <p>עוד אין טיול בקבוצה.</p>
                    <Link
                      href={`/g/${groupId}`}
                      className="tap mt-3 flex items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-bold text-white transition active:scale-[0.98]"
                    >
                      ליצירת טיול
                    </Link>
                  </>
                ) : (
                  <p>עוד אין טיול בקבוצה. מנהל/ת הקבוצה ייצור/תיצור אותו, והוא יופיע כאן.</p>
                )}
              </div>
            ) : (
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
            )}
          </section>
        );
      })}
    </main>
  );
}
