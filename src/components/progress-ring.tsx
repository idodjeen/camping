"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

const TONES = {
  rose: { card: "bg-rose", sub: "text-rose-ink", stroke: "var(--c-rose-strong)" },
  sage: { card: "bg-sage", sub: "text-sage-ink", stroke: "var(--c-sage-strong)" },
} as const;

/**
 * Circular progress on a tinted card. Drawn with stroke-dasharray on an SVG
 * circle rotated so 0% starts at twelve o'clock, and animated by tweening
 * strokeDashoffset, a GPU-friendly property, unlike animating the path itself.
 * The track is the canvas colour, so the ring reads as cut out of the card.
 */
export function ProgressRing({
  done,
  total,
  label,
  tone = "rose",
}: {
  done: number;
  total: number;
  label: string;
  tone?: keyof typeof TONES;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const t = TONES[tone];

  return (
    <div className={cn("flex items-center gap-3 rounded-[1.75rem] p-4", t.card)}>
      <div className="relative shrink-0">
        <svg width="76" height="76" viewBox="0 0 80 80" className="-rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--c-canvas)" strokeWidth="9" />
          <motion.circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={t.stroke}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-[19px] tabular-nums" dir="ltr">
            {pct}%
          </span>
        </div>
      </div>
      <div className="min-w-0 leading-tight">
        <p className="text-[15px] font-bold text-ink">{label}</p>
        <p className={cn("mt-0.5 text-[13px] tabular-nums", t.sub)} dir="ltr">
          {done}/{total}
        </p>
      </div>
    </div>
  );
}
