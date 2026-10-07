"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/expenses";
import { cn } from "@/lib/utils";

export type DonutSlice = {
  key: string;
  label: string;
  /** Integer agorot. */
  amount: number;
  /** A CSS color, normally one of the --color-series-N tokens. */
  color: string;
};

const SIZE = 184;
const C = SIZE / 2;
const OUTER = 80;
const INNER = 56;
/** The selected slice grows outwards by this much. */
const LIFT = 5;
/** Surface gap between neighbouring slices, in px. */
const GAP = 2;

/** A point on the circle, with 0 at twelve o'clock and angles growing clockwise. */
function at(r: number, angle: number) {
  return `${(C + r * Math.sin(angle)).toFixed(2)} ${(C - r * Math.cos(angle)).toFixed(2)}`;
}

/**
 * One ring segment between two angles. Each edge is pulled in by GAP/2 of arc
 * length at its own radius, so the gap between slices has parallel sides
 * instead of a wedge that widens outwards.
 */
function sector(start: number, end: number, outer: number) {
  const pad = (r: number) => {
    const p = GAP / 2 / r;
    // A sliver thinner than the gap still gets a hairline, so it isn't lost.
    return end - start > 2 * p ? p : (end - start) / 2 - 0.002;
  };
  const o0 = start + pad(outer);
  const o1 = end - pad(outer);
  const i0 = start + pad(INNER);
  const i1 = end - pad(INNER);
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${at(outer, o0)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${at(outer, o1)}`,
    `L ${at(INNER, i1)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${at(INNER, i0)}`,
    "Z",
  ].join(" ");
}

/** A whole ring, for a single slice: an arc can't draw a full 360 degrees. */
function ring(outer: number) {
  const circle = (r: number, sweep: 0 | 1) =>
    `M ${C - r} ${C} A ${r} ${r} 0 1 ${sweep} ${C + r} ${C} A ${r} ${r} 0 1 ${sweep} ${C - r} ${C} Z`;
  return `${circle(outer, 1)} ${circle(INNER, 0)}`;
}

function percent(amount: number, total: number) {
  const p = Math.round((amount / total) * 100);
  return p === 0 && amount > 0 ? "<1%" : `${p}%`;
}

/**
 * A donut of money, drawn by hand: one arc per slice from twelve o'clock in
 * the order given (the caller sorts, largest first), the total in the middle,
 * and a legend that is the accessible version of the same numbers.
 *
 * Tapping a slice or its legend row selects it: the others dim and the middle
 * shows that slice instead of the total. A mouse previews the same on hover.
 */
export function DonutChart({ slices, label }: { slices: DonutSlice[]; label: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const shown = slices.filter((s) => s.amount > 0);
  const total = shown.reduce((sum, s) => sum + s.amount, 0);
  if (total === 0) return null;

  const activeKey = hovered ?? selected;
  const active = shown.find((s) => s.key === activeKey) ?? null;
  const toggle = (key: string) => setSelected((cur) => (cur === key ? null : key));
  const hover = (key: string | null) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setHovered(key);
  };

  let angle = 0;
  const arcs = shown.map((s) => {
    const start = angle;
    angle += (s.amount / total) * 2 * Math.PI;
    return { ...s, start, end: angle };
  });

  const summary = `${label}: ${shown
    .map((s) => `${s.label} ${formatMoney(s.amount)} (${percent(s.amount, total)})`)
    .join(", ")}`;

  return (
    <div>
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={summary}>
          {arcs.map((a) => {
            const isActive = a.key === activeKey;
            const outer = isActive ? OUTER + LIFT : OUTER;
            return (
              <path
                key={a.key}
                d={arcs.length === 1 ? ring(outer) : sector(a.start, a.end, outer)}
                fill={a.color}
                fillRule="evenodd"
                onClick={() => toggle(a.key)}
                onPointerEnter={hover(a.key)}
                onPointerLeave={hover(null)}
                className={cn(
                  "cursor-pointer transition-opacity duration-200",
                  activeKey && !isActive && "opacity-30",
                )}
              />
            );
          })}
        </svg>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center text-center"
        >
          <div className="max-w-[96px]">
            <p className="truncate text-[11px] text-white/50">{active ? active.label : "סה״כ"}</p>
            <p className="text-lg font-bold tabular-nums">{formatMoney(active ? active.amount : total)}</p>
            {active && (
              <p className="text-[11px] tabular-nums text-white/50">{percent(active.amount, total)}</p>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-0.5">
        {shown.map((s) => {
          const isActive = s.key === activeKey;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                onPointerEnter={hover(s.key)}
                onPointerLeave={hover(null)}
                aria-pressed={s.key === selected}
                className={cn(
                  "tap flex w-full items-center gap-2.5 rounded-xl px-2.5 text-sm transition",
                  isActive ? "bg-white/8" : activeKey ? "opacity-50" : "",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-start">{s.label}</span>
                <span className="font-semibold tabular-nums">{formatMoney(s.amount)}</span>
                <span className="w-10 shrink-0 text-end text-xs tabular-nums text-white/45">
                  {percent(s.amount, total)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
