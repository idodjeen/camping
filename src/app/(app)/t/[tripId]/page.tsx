"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, ChevronLeft, MapPin, Package, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { Countdown } from "@/components/countdown";
import { LocationCard } from "@/components/location-card";
import { Podium } from "@/components/podium";
import { ProgressRing } from "@/components/progress-ring";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { WeatherCard } from "@/components/weather-card";
import { fetcher, send, swrConfig } from "@/lib/api";
import { SLOT_LABELS, daysUntil, formatShortDate, formatTripDay } from "@/lib/dates";
import { useTrip } from "@/lib/trip-client";

type Dashboard = {
  trip: {
    name: string;
    startDate: string;
    endDate: string;
    lat: number;
    lng: number;
    locationName: string | null;
  } | null;
  progress: { gear: { done: number; total: number }; shopping: { done: number; total: number } };
  nextMeal: {
    id: number;
    date: string;
    slot: string;
    title: string;
    description: string | null;
  } | null;
  unclaimed: {
    id: number;
    name: string;
    qtyLabel: string | null;
    remaining: number | null;
    categoryName: string;
  }[];
};
type Person = { id: number; name: string; slug: string; avatarUrl: string | null };
type Me = {
  user: {
    name: string;
    slug: string;
    avatarUrl: string | null;
    isAdmin: boolean;
    isShopper: boolean;
    isViewer: boolean;
  };
  people: Person[];
};

/** How many waiting items the home screen lists before pointing at the gear tab. */
const WAITING_SHOWN = 4;

/** "1.10", for a range on one line. The year is the trip's, and obvious. */
const dayMonth = (date: string) => formatShortDate(date).replace(/\.\d{4}$/, "");

/**
 * The trip at a glance, ordered by what you can do about it: the trip itself,
 * how ready it is, what is still waiting for someone (with a button to take
 * it), then the next meal, the leaderboard, the weather and the way there.
 */
export default function HomePage() {
  const { api, page } = useTrip();
  const { data, mutate } = useSWR<Dashboard>(api("/dashboard"), fetcher, swrConfig);
  const { data: me } = useSWR<Me>(api("/me"), fetcher, swrConfig);
  const trip = data?.trip;

  return (
    <div className="space-y-4">
      <Greeting me={me} />

      {trip ? (
        <TripHero trip={trip} people={me?.people ?? []} />
      ) : (
        <div className="h-64 animate-pulse rounded-hero bg-peach" aria-hidden />
      )}

      {/* Each ring opens its own list already filtered to what it counts. */}
      <section className="grid grid-cols-2 gap-3">
        <Link
          href={{ pathname: page("/gear"), query: { filter: "done" } }}
          className="transition active:scale-[0.97]"
        >
          <ProgressRing
            done={data?.progress.gear.done ?? 0}
            total={data?.progress.gear.total ?? 0}
            label="ציוד מכוסה"
            tone="rose"
          />
        </Link>
        <Link
          href={{ pathname: page("/shopping"), query: { filter: "bought" } }}
          className="transition active:scale-[0.97]"
        >
          <ProgressRing
            done={data?.progress.shopping.done ?? 0}
            total={data?.progress.shopping.total ?? 0}
            label="קניות שבוצעו"
            tone="sage"
          />
        </Link>
      </section>

      <Waiting
        items={data?.unclaimed}
        canClaim={me ? !me.user.isViewer : false}
        onClaimed={() => mutate()}
      />

      {data?.nextMeal && (
        <Link href={page("/meals")} className="card flex items-center gap-3 p-3 pe-4 transition active:scale-[0.99]">
          <span className="grid size-12 shrink-0 place-items-center rounded-tile bg-amber text-amber-ink">
            <UtensilsCrossed className="size-[22px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block text-[13px] font-bold text-muted">
              הארוחה הבאה · {formatTripDay(data.nextMeal.date)} · {SLOT_LABELS[data.nextMeal.slot]}
            </span>
            <span className="block text-base font-bold text-ink">{data.nextMeal.title}</span>
            {data.nextMeal.description && (
              <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{data.nextMeal.description}</span>
            )}
          </span>
          <ChevronLeft className="size-5 shrink-0 text-muted ltr:rotate-180" aria-hidden />
        </Link>
      )}

      <Podium linked />

      <WeatherCard />

      {trip && <LocationCard lat={trip.lat} lng={trip.lng} locationName={trip.locationName} />}
    </div>
  );
}

function Greeting({ me }: { me: Me | undefined }) {
  if (!me) {
    return (
      <div className="flex items-center gap-3.5 px-1" aria-hidden>
        <div className="size-14 animate-pulse rounded-full bg-peach" />
        <div className="h-8 w-32 animate-pulse rounded-full bg-line" />
      </div>
    );
  }
  const u = me.user;
  return (
    <header className="flex items-center gap-3.5 px-1">
      <UserAvatar
        name={u.name}
        slug={u.slug}
        avatarUrl={u.avatarUrl}
        size={58}
        className="ring-[3px] ring-surface shadow-[0_2px_10px_var(--c-shadow)]"
        expandable
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[28px] leading-tight text-ink">היי {u.name}</h1>
        {(u.isAdmin || u.isShopper || u.isViewer) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {u.isAdmin && <Chip className="bg-peach text-peach-ink">מנהל</Chip>}
            {u.isShopper && <Chip className="bg-sage text-sage-ink">קניות</Chip>}
            {u.isViewer && <Chip className="bg-amber text-amber-ink">צפייה בלבד</Chip>}
          </div>
        )}
      </div>
    </header>
  );
}

function TripHero({ trip, people }: { trip: NonNullable<Dashboard["trip"]>; people: Person[] }) {
  const toStart = daysUntil(trip.startDate);
  const toEnd = daysUntil(trip.endDate);
  const status =
    toStart > 0 ? (toStart === 1 ? "מחר יוצאים" : `עוד ${toStart} ימים`)
    : toEnd >= 0 ? "אנחנו בטיול"
    : "הטיול הסתיים";
  const shown = people.slice(0, 5);

  return (
    <section className="relative overflow-hidden rounded-hero bg-peach p-5 pb-5">
      <TentArt className="absolute end-4 top-4 h-[74px] w-[104px]" />

      <div className="relative max-w-[70%]">
        <span className="inline-flex h-7 items-center rounded-full bg-cta px-3 text-[13px] font-bold text-on-cta">
          {status}
        </span>
        <h2 className="mt-2.5 font-display text-[32px] leading-[1.1] text-ink">{trip.name}</h2>
        <p className="mt-2 flex items-center gap-1.5 text-[15px] text-peach-ink">
          <CalendarDays className="size-4 shrink-0" aria-hidden />
          {/* dir=ltr: the dash between two LTR date runs is bidi-neutral, so
              in an RTL paragraph the range renders end-first and reads as
              though the trip runs backwards. */}
          <span dir="ltr">
            {dayMonth(trip.startDate)} - {dayMonth(trip.endDate)}
          </span>
        </p>
        {trip.locationName && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-peach-ink">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{trip.locationName}</span>
          </p>
        )}
      </div>

      {toStart > 0 && (
        <div className="relative mt-4">
          <Countdown startDate={trip.startDate} />
        </div>
      )}

      {shown.length > 0 && (
        <div className="relative mt-4 flex items-center gap-2.5">
          <div className="flex">
            {shown.map((p, i) => (
              <UserAvatar
                key={p.id}
                name={p.name}
                slug={p.slug}
                avatarUrl={p.avatarUrl}
                size={36}
                className={i === 0 ? "ring-[2.5px] ring-peach" : "-ms-2.5 ring-[2.5px] ring-peach"}
              />
            ))}
          </div>
          <span className="text-sm font-semibold text-peach-ink">
            {people.length > shown.length ? `ועוד ${people.length - shown.length} · ` : ""}
            {people.length} בטיול
          </span>
        </div>
      )}
    </section>
  );
}

function Waiting({
  items,
  canClaim,
  onClaimed,
}: {
  items: Dashboard["unclaimed"] | undefined;
  canClaim: boolean;
  onClaimed: () => void;
}) {
  const { api, page } = useTrip();
  const [busy, setBusy] = useState<number | null>(null);

  async function claim(item: Dashboard["unclaimed"][number]) {
    setBusy(item.id);
    try {
      await send(api(`/gear/${item.id}/claim`), "POST", { qty: 1 });
      toast(`רשמנו אותך על ${item.name}`, "ok");
      onClaimed();
    } catch (e) {
      // The server says why: someone took the last one first, or you can only view.
      toast(e instanceof Error ? e.message : "לא הצלחנו לרשום");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-lg text-ink">מחכים למישהו</h2>
        <Link href={page("/gear")} className="text-sm font-bold text-link">
          {items && items.length > WAITING_SHOWN ? `עוד ${items.length - WAITING_SHOWN} בציוד` : "לכל הציוד"}
        </Link>
      </div>

      {!items ? (
        <div className="card h-[72px] animate-pulse" aria-hidden />
      ) : items.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-card bg-sage px-4 py-5 text-[15px] font-bold text-sage-ink">
          <Check className="size-5" aria-hidden />
          כל הציוד מכוסה
        </p>
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {items.slice(0, WAITING_SHOWN).map((item) => (
              <motion.li
                key={item.id}
                layout
                exit={{ opacity: 0, scale: 0.96 }}
                className="card flex items-center gap-3 p-3 pe-3.5"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-tile bg-peach text-peach-ink">
                  <Package className="size-[22px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 leading-snug">
                  <p className="truncate text-base font-bold text-ink">
                    {item.name}
                    {item.qtyLabel && <span className="font-normal text-muted"> · {item.qtyLabel}</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {item.remaining !== null ? `נשאר ${item.remaining} · ` : ""}
                    {item.categoryName}
                  </p>
                </div>
                {canClaim && (
                  <button
                    onClick={() => claim(item)}
                    disabled={busy !== null}
                    className="h-11 shrink-0 rounded-full bg-cta px-4 text-[15px] font-bold text-on-cta transition active:scale-95 disabled:opacity-60"
                  >
                    {busy === item.id ? "רושמים..." : "אני מביא"}
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-bold ${className}`}>
      {children}
    </span>
  );
}

/** The tent from the app icon, drawn in the theme's own colours. */
function TentArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 170 120" className={className} aria-hidden>
      <circle cx="62" cy="64" r="58" fill="var(--c-tent-glow)" />
      <path d="M20 118 L84 30 L148 118 Z" fill="var(--c-tent)" />
      <path d="M66 118 L84 78 L102 118 Z" fill="var(--c-peach)" />
    </svg>
  );
}
