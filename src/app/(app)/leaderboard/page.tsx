"use client";

import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { PageTitle, SkeletonList } from "@/components/skeletons";
import { UserAvatar } from "@/components/user-avatar";
import { fetcher, swrConfig } from "@/lib/api";
import type { LeaderRow, SCORING, Title } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

type Payload = {
  rows: LeaderRow[];
  titles: NonNullable<Title>[];
  idle: { userId: number; name: string; slug: string; avatarUrl: string | null }[];
  scoring: typeof SCORING;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { data, isLoading } = useSWR<Payload>("/api/leaderboard", fetcher, swrConfig);
  const [showHow, setShowHow] = useState(false);

  if (isLoading && !data) {
    return (
      <>
        <PageTitle title="טבלת התורמים" />
        <SkeletonList rows={5} />
      </>
    );
  }
  if (!data?.rows) return null;

  const leader = data.rows[0];

  return (
    <>
      <PageTitle title="טבלת התורמים" subtitle="מי באמת מרים את הטיול הזה" />

      {data.titles.length > 0 && (
        <section className="mb-5 grid grid-cols-2 gap-2">
          {data.titles.map((t) => (
            <div key={t.key} className="glass flex items-center gap-2 rounded-2xl p-2.5">
              <span className="text-xl" aria-hidden>
                {t.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-brand-300">{t.label}</p>
                <p className="truncate text-sm font-bold">{t.name}</p>
                <p className="truncate text-[10px] text-white/40">{t.note}</p>
              </div>
              <UserAvatar name={t.name} slug={t.slug} avatarUrl={t.avatarUrl} size={28} />
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        {data.rows.map((r, i) => {
          const pct = leader?.score ? Math.round((r.score / leader.score) * 100) : 0;
          return (
            <motion.div
              key={r.userId}
              layout
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className={cn(
                "glass relative overflow-hidden rounded-2xl p-3.5",
                i === 0 && "border-amber-300/25",
              )}
            >
              {/* Score bar sits behind the row, inset-inline-start so it grows
                  from the right edge in RTL without any manual flipping. */}
              <div
                className={cn(
                  "absolute inset-y-0 start-0 -z-10",
                  i === 0 ? "bg-amber-400/10" : "bg-brand-500/8",
                )}
                style={{ width: `${pct}%` }}
                aria-hidden
              />

              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-lg" aria-hidden>
                  {MEDALS[i] ?? <span className="text-sm text-white/35">{i + 1}</span>}
                </span>
                <UserAvatar
                  name={r.name}
                  slug={r.slug}
                  avatarUrl={r.avatarUrl}
                  size={38}
                  expandable
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{r.name}</p>
                  <p className="text-[11px] text-white/40">
                    {r.itemsClaimed} פריטים
                    {r.unitsClaimed > r.itemsClaimed && ` · ${r.unitsClaimed} יחידות`}
                    {r.packed > 0 && ` · ${r.packed} ארוז`}
                    {r.bought > 0 && ` · ${r.bought} קניות`}
                    {r.added > 0 && ` · ${r.added} הוספות`}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-xl font-black tabular-nums">{r.score}</p>
                  <p className="-mt-1 text-[10px] text-white/35">נק׳</p>
                </div>
              </div>

              {r.score > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 ps-9">
                  <Chip label="פריטים" value={r.breakdown.items} />
                  {r.breakdown.units > 0 && <Chip label="יחידות" value={r.breakdown.units} />}
                  {r.breakdown.packed > 0 && <Chip label="ארוז" value={r.breakdown.packed} />}
                  {r.breakdown.added > 0 && <Chip label="יוזמה" value={r.breakdown.added} />}
                </div>
              )}
            </motion.div>
          );
        })}
      </section>

      {data.idle.length > 0 && (
        <section className="glass mt-4 rounded-2xl p-4">
          <p className="text-sm font-semibold text-white/70">עוד לא תפסו כלום</p>
          <div className="mt-2 flex items-center gap-2">
            {data.idle.map((u) => (
              <div key={u.userId} className="flex items-center gap-1.5">
                <UserAvatar name={u.name} slug={u.slug} avatarUrl={u.avatarUrl} size={26} />
                <span className="text-sm text-white/55">{u.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/35">יש עוד הרבה ציוד פנוי 👀</p>
        </section>
      )}

      <button
        onClick={() => setShowHow((v) => !v)}
        className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 text-xs font-semibold text-white/45"
      >
        <Info className="size-3.5" />
        איך זה נספר?
      </button>

      {showHow && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="glass mt-2 overflow-hidden rounded-2xl p-4 text-xs leading-relaxed text-white/55"
        >
          <ul className="space-y-1.5">
            <li>
              <b className="text-white/80">{data.scoring.perItem} נק׳</b> על כל פריט ציוד שתפסת
            </li>
            <li>
              <b className="text-white/80">{data.scoring.perExtraUnit} נק׳</b> על כל יחידה נוספת,
              עד {data.scoring.maxExtraUnits} לפריט
            </li>
            <li>
              <b className="text-white/80">{data.scoring.perPacked} נק׳</b> על כל פריט שכבר ארזת
            </li>
            <li>
              <b className="text-white/80">{data.scoring.perAdded} נק׳</b> על כל פריט שהוספת לרשימות
            </li>
          </ul>
          <p className="mt-3 text-white/35">
            קניות לא נספרות בניקוד — רק עידו וניר יכולים לסמן שנקנה, אז זה לא היה הוגן. יש להן
            תואר משלהן 🛒
          </p>
        </motion.div>
      )}
    </>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] text-white/45">
      {label} <span className="tabular-nums text-white/70">+{value}</span>
    </span>
  );
}
