"use client";

import { motion } from "framer-motion";
import { ChevronLeft, PackageOpen } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { Countdown } from "@/components/countdown";
import { LocationCard } from "@/components/location-card";
import { ProgressRing } from "@/components/progress-ring";
import { UserAvatar } from "@/components/user-avatar";
import { WeatherCard } from "@/components/weather-card";
import { fetcher, swrConfig } from "@/lib/api";
import { SLOT_LABELS, formatShortDate, formatTripDay } from "@/lib/dates";

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
type Me = {
  user: { name: string; slug: string; avatarUrl: string | null; isAdmin: boolean; isShopper: boolean };
};

export default function HomePage() {
  const { data } = useSWR<Dashboard>("/api/dashboard", fetcher, swrConfig);
  const { data: me } = useSWR<Me>("/api/me", fetcher, swrConfig);
  const trip = data?.trip;

  return (
    <>
      <header className="flex items-center gap-3">
        {me ? (
          <UserAvatar
            name={me.user.name}
            slug={me.user.slug}
            avatarUrl={me.user.avatarUrl}
            size={44}
            expandable
          />
        ) : (
          <div className="size-11 animate-pulse rounded-full bg-white/10" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/50">שלום,</p>
          <p className="truncate text-lg font-bold">{me?.user.name ?? "…"}</p>
        </div>
        <div className="flex gap-1.5">
          {me?.user.isAdmin && <Badge>מנהל</Badge>}
          {me?.user.isShopper && <Badge>קניות</Badge>}
        </div>
      </header>

      <section className="glass glow-brand mt-6 rounded-glass p-6 text-center">
        <h1 className="bg-gradient-to-l from-brand-300 via-ocean-400 to-aqua-300 bg-clip-text text-3xl font-bold text-transparent">
          {trip?.name ?? "מחנאות 2026"}
        </h1>
        {trip && (
          <p className="mt-1 text-sm text-white/60">
            {/* dir=ltr: the dash between two LTR date runs is bidi-neutral, so
                in an RTL paragraph the range renders end-first and reads as
                though the trip runs backwards. */}
            <span dir="ltr">
              {formatShortDate(trip.startDate)} – {formatShortDate(trip.endDate)}
            </span>
            {trip.locationName ? ` · ${trip.locationName}` : ""}
          </p>
        )}
        <div className="mt-6">
          {trip ? (
            <Countdown startDate={trip.startDate} />
          ) : (
            <div className="h-[4.5rem] animate-pulse rounded-xl bg-white/5" />
          )}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <ProgressRing
          done={data?.progress.gear.done ?? 0}
          total={data?.progress.gear.total ?? 0}
          label="ציוד מכוסה"
        />
        <ProgressRing
          done={data?.progress.shopping.done ?? 0}
          total={data?.progress.shopping.total ?? 0}
          label="קניות שבוצעו"
          color="aqua"
        />
      </section>

      <section className="mt-4">
        <WeatherCard />
      </section>

      {trip && (
        <section className="mt-4">
          <LocationCard lat={trip.lat} lng={trip.lng} locationName={trip.locationName} />
        </section>
      )}

      {data?.nextMeal && (
        <section className="mt-4">
          <Link href="/meals" className="glass block rounded-glass p-4 transition active:scale-[0.99]">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-300">
                הארוחה הבאה
              </span>
              <span className="text-[11px] text-white/40">
                {formatTripDay(data.nextMeal.date)} · {SLOT_LABELS[data.nextMeal.slot]}
              </span>
              <ChevronLeft className="ms-auto size-4 text-white/30" />
            </div>
            <p className="mt-1.5 font-bold">{data.nextMeal.title}</p>
            {data.nextMeal.description && (
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                {data.nextMeal.description}
              </p>
            )}
          </Link>
        </section>
      )}

      <section className="mt-4">
        <div className="mb-2 flex items-center gap-2 px-1">
          <PackageOpen className="size-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white/50">
            עוד חסר {data ? `(${data.unclaimed.length})` : ""}
          </h2>
          <Link href="/gear" className="ms-auto text-xs font-semibold text-brand-300">
            למסך הציוד
          </Link>
        </div>

        {data && data.unclaimed.length === 0 ? (
          <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-aqua-300">
            כל הציוד מכוסה 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {data?.unclaimed.slice(0, 6).map((item) => (
              <motion.div key={item.id} layout className="glass flex items-center gap-3 rounded-2xl p-3">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{item.name}</span>
                  {item.qtyLabel && (
                    <span className="ms-2 rounded-md bg-white/8 px-1.5 py-0.5 text-[11px] text-white/55">
                      {item.qtyLabel}
                    </span>
                  )}
                  <p className="text-[11px] text-white/35">{item.categoryName}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-white/40">
                  נשאר {item.remaining}
                </span>
              </motion.div>
            ))}
            {data && data.unclaimed.length > 6 && (
              <Link
                href="/gear"
                className="tap flex items-center justify-center rounded-2xl border border-dashed border-white/12 text-xs font-semibold text-white/45"
              >
                ועוד {data.unclaimed.length - 6} פריטים
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-brand-400/30 bg-brand-500/15 px-2.5 py-1 text-[11px] font-semibold text-brand-300">
      {children}
    </span>
  );
}
