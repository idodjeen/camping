import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { UserAvatar } from "@/components/user-avatar";
import { db } from "@/db";
import { gearItems, meals, shoppingItems, trip, users } from "@/db/schema";
import { daysUntil, formatShortDate } from "@/lib/dates";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const [tripRow] = await db.select().from(trip).where(eq(trip.id, 1));
  const [[gear], [shopping], [mealCount], [crew]] = await Promise.all([
    db.select({ n: count() }).from(gearItems),
    db.select({ n: count() }).from(shoppingItems),
    db.select({ n: count() }).from(meals),
    db.select({ n: count() }).from(users),
  ]);

  const days = tripRow ? daysUntil(tripRow.startDate) : null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-8">
      <header className="flex items-center gap-3">
        <UserAvatar name={me.name} slug={me.slug} avatarUrl={me.avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/50">שלום,</p>
          <p className="truncate text-lg font-bold">{me.name}</p>
        </div>
        <div className="flex gap-1.5">
          {me.isAdmin && <Badge>מנהל</Badge>}
          {me.isShopper && <Badge>קניות</Badge>}
        </div>
      </header>

      {tripRow && (
        <section className="glass glow-brand mt-6 rounded-glass p-6 text-center">
          <h1 className="bg-gradient-to-l from-brand-300 via-ocean-400 to-aqua-300 bg-clip-text text-3xl font-bold text-transparent">
            {tripRow.name}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {formatShortDate(tripRow.startDate)} – {formatShortDate(tripRow.endDate)}
            {tripRow.locationName ? ` · ${tripRow.locationName}` : ""}
          </p>

          {days !== null && (
            <div className="mt-6">
              <div className="text-6xl font-black tabular-nums text-white">
                {Math.max(days, 0)}
              </div>
              <p className="mt-1 text-sm text-white/60">
                {days > 1 ? "ימים לטיול" : days === 1 ? "יום לטיול" : days === 0 ? "יוצאים היום!" : "הטיול כבר התחיל"}
              </p>
            </div>
          )}
        </section>
      )}

      <section className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="פריטי ציוד" value={gear.n} />
        <Stat label="פריטי קנייה" value={shopping.n} />
        <Stat label="ארוחות" value={mealCount.n} />
        <Stat label="חברים" value={crew.n} />
      </section>

      <section className="glass mt-5 rounded-glass p-5">
        <p className="text-sm font-semibold text-white/80">שלב 2 הושלם ✅</p>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          מסכי הציוד, הקניות, הארוחות והרשימה האישית פעילים. בשלב הבא: ספירה לאחור,
          תחזית מזג אוויר, ניווט ואונבורדינג.
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-white/50">{label}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-brand-400/30 bg-brand-500/15 px-2.5 py-1 text-[11px] font-semibold text-brand-300">
      {children}
    </span>
  );
}
