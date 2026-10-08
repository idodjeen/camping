"use client";

import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { UserAvatar } from "@/components/user-avatar";
import { fetcher, swrConfig } from "@/lib/api";
import type { LeaderRow, Title } from "@/lib/leaderboard";
import { useTrip } from "@/lib/trip-client";
import { cn } from "@/lib/utils";

type Payload = { rows: LeaderRow[]; titles: NonNullable<Title>[] };

// First place is bigger and ringed in the action colour; second and third
// match. Straight descending order rather than the classic winner-in-the-
// middle podium: in RTL the first column sits rightmost, so the scores read
// 199 -> 110 -> 90 the way you read the rest of the page.
const SIZES = [84, 64, 64];

/**
 * The top three, rendered identically on the dashboard and at the top of the
 * leaderboard tab: one component, so the two can never drift apart.
 *
 * `linked` turns it into a link into the full board. It is off on the board
 * itself, where linking to the page you are already on is a dead tap. A
 * boolean rather than an href because typedRoutes wants the route literal.
 */
export function Podium({ linked = false }: { linked?: boolean }) {
  const { api, page } = useTrip();
  const { data } = useSWR<Payload>(api("/leaderboard"), fetcher, swrConfig);
  const top = data?.rows?.slice(0, 3) ?? [];

  const inner = (
    <>
      <div className="mb-4 flex items-center gap-2">
        <span className="font-display text-[19px] text-ink">הכוכבים של הטיול</span>
        {linked && (
          <span className="ms-auto flex items-center gap-0.5 text-sm font-bold text-amber-ink">
            הטבלה המלאה
            <ChevronLeft className="size-4 ltr:rotate-180" />
          </span>
        )}
      </div>

      {top.length === 0 ? (
        <div className="h-32 animate-pulse rounded-card bg-surface/50" aria-hidden />
      ) : (
        <ol className="flex items-end justify-around">
          {top.map((r, idx) => (
            <motion.li
              key={r.userId}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="flex w-24 flex-col items-center"
            >
              <span className="relative">
                <UserAvatar
                  name={r.name}
                  slug={r.slug}
                  avatarUrl={r.avatarUrl}
                  size={SIZES[idx]}
                  className={cn(idx === 0 ? "ring-4 ring-cta" : "ring-[3px] ring-surface")}
                />
                <span
                  aria-label={`מקום ${idx + 1}`}
                  className={cn(
                    "absolute -bottom-1 -end-1 grid place-items-center rounded-full border-2 border-amber text-xs font-bold",
                    idx === 0 ? "size-7 bg-cta text-on-cta" : "size-6 bg-ink text-canvas",
                  )}
                >
                  {idx + 1}
                </span>
              </span>
              <span className="mt-2 max-w-full truncate text-[15px] font-bold text-ink">{r.name}</span>
              <span className="text-[13px] tabular-nums text-amber-ink">{r.score} נק׳</span>
            </motion.li>
          ))}
        </ol>
      )}
    </>
  );

  const shell = "block rounded-[2rem] bg-amber px-4 pt-4 pb-5";
  if (linked) {
    return (
      <Link href={page("/leaderboard")} className={cn(shell, "transition active:scale-[0.99]")}>
        {inner}
      </Link>
    );
  }
  return <div className={shell}>{inner}</div>;
}
