"use client";

import { motion } from "framer-motion";

/**
 * Circular progress. Drawn with stroke-dasharray on an SVG circle rotated so
 * 0% starts at twelve o'clock, and animated by tweening strokeDashoffset — a
 * GPU-friendly property, unlike animating the path itself.
 */
export function ProgressRing({
  done,
  total,
  label,
  color = "brand",
}: {
  done: number;
  total: number;
  label: string;
  color?: "brand" | "aqua";
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const stroke = color === "aqua" ? "var(--color-aqua-400)" : "var(--color-brand-400)";

  return (
    <div className="glass flex flex-col items-center rounded-2xl p-4">
      <div className="relative">
        <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="8" />
          <motion.circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
            transition={{ type: "spring", stiffness: 60, damping: 18 }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-xl font-black tabular-nums">{pct}%</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-white/60">{label}</p>
      <p className="text-[11px] tabular-nums text-white/35">
        {done}/{total}
      </p>
    </div>
  );
}
