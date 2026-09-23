"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Trophy } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { UserAvatar } from "@/components/user-avatar";
import { fetcher, swrConfig } from "@/lib/api";
import type { LeaderRow, Title } from "@/lib/leaderboard";

type Payload = { rows: LeaderRow[]; titles: NonNullable<Title>[] };

const MEDALS = ["🥇", "🥈", "🥉"];
// Straight descending order rather than the classic winner-in-the-middle
// podium: in RTL the first column sits rightmost, so the scores read
// 199 → 110 → 90 the way you read the rest of the page.
const HEIGHTS = ["h-16", "h-11", "h-8"];

/**
 * The top three, rendered identically on the dashboard and at the top of the
 * leaderboard tab — one component, so the two can never drift apart.
 *
 * `linked` turns it into a link into the full board. It is off on the board
 * itself, where linking to the page you are already on is a dead tap. A
 * boolean rather than an href because typedRoutes wants the route literal.
 */
export function Podium({ linked = false }: { linked?: boolean }) {
  const { data } = useSWR<Payload>("/api/leaderboard", fetcher, swrConfig);
  const top = data?.rows?.slice(0, 3) ?? [];

  const inner = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="size-4 text-amber-300" />
        <span className="text-sm font-semibold">טבלת התורמים</span>
        {linked && <ChevronLeft className="ms-auto size-4 text-white/30" />}
      </div>

      {top.length === 0 ? (
        <div className="h-24 animate-pulse rounded-xl bg-white/5" aria-hidden />
      ) : (
        <div className="flex items-end justify-center gap-3">
          {top.map((r, idx) => {
            return (
              <motion.div
                key={r.userId}
                layout
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="flex w-20 flex-col items-center"
              >
                <span className="mb-1 text-lg" aria-hidden>
                  {MEDALS[idx]}
                </span>
                <UserAvatar
                  name={r.name}
                  slug={r.slug}
                  avatarUrl={r.avatarUrl}
                  size={idx === 0 ? 46 : 38}
                />
                <span className="mt-1.5 truncate text-xs font-semibold">{r.name}</span>
                <span className="text-[11px] tabular-nums text-white/45">{r.score} נק׳</span>
                <div
                  className={`mt-1.5 w-full rounded-t-lg bg-gradient-to-t ${
                    idx === 0 ? "from-amber-500/30 to-amber-300/50" : "from-white/5 to-white/15"
                  } ${HEIGHTS[idx]}`}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );

  if (linked) {
    return (
      <Link
        href="/leaderboard"
        className="glass block rounded-glass p-4 transition active:scale-[0.99]"
      >
        {inner}
      </Link>
    );
  }
  return <div className="glass rounded-glass p-4">{inner}</div>;
}
