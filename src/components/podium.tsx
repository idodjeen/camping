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
// Second place on the right, winner centre, third on the left — the classic
// arrangement, and in RTL the eye lands on the centre column either way.
const ORDER = [1, 0, 2];
const HEIGHTS = ["h-12", "h-16", "h-9"];

export function Podium() {
  const { data } = useSWR<Payload>("/api/leaderboard", fetcher, swrConfig);
  const top = data?.rows?.slice(0, 3) ?? [];

  return (
    <Link href="/leaderboard" className="glass block rounded-glass p-4 transition active:scale-[0.99]">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="size-4 text-amber-300" />
        <span className="text-sm font-semibold">טבלת התורמים</span>
        <ChevronLeft className="ms-auto size-4 text-white/30" />
      </div>

      {top.length === 0 ? (
        <div className="h-24 animate-pulse rounded-xl bg-white/5" aria-hidden />
      ) : (
        <div className="flex items-end justify-center gap-3">
          {ORDER.map((idx, col) => {
            const r = top[idx];
            if (!r) return <div key={col} className="w-20" />;
            return (
              <motion.div
                key={r.userId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26, delay: col * 0.05 }}
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
                    idx === 0
                      ? "from-amber-500/30 to-amber-300/50"
                      : "from-white/5 to-white/15"
                  } ${HEIGHTS[idx]}`}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </Link>
  );
}
