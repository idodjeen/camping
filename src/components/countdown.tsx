"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown to the trip, in Israel time, sized for the home screen's
 * trip card. Once the trip has started it renders nothing: the card says
 * "אנחנו בטיול" by itself.
 *
 * Renders a placeholder until mounted. The server and the browser would
 * otherwise compute a different "now" milliseconds apart, and React would flag
 * a hydration mismatch on a value that is different by definition on every tick.
 */
export function Countdown({ startDate }: { startDate: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    // The trip starts on the morning of startDate, Israel time (UTC+3 in October).
    const target = Date.parse(`${startDate}T09:00:00+03:00`);
    const tick = () => setLeft(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startDate]);

  if (left === null) {
    return <div className="h-[3.75rem] animate-pulse rounded-tile bg-surface/40" aria-hidden />;
  }
  if (left <= 0) return null;

  const s = Math.floor(left / 1000);
  const parts = [
    { v: Math.floor(s / 86400), label: "ימים" },
    { v: Math.floor((s % 86400) / 3600), label: "שעות" },
    { v: Math.floor((s % 3600) / 60), label: "דקות" },
    { v: s % 60, label: "שניות" },
  ];

  return (
    <div className="flex gap-2" role="timer" aria-label={`עוד ${parts[0].v} ימים ו-${parts[1].v} שעות`}>
      {parts.map((p) => (
        <div key={p.label} className="min-w-[3.4rem] flex-1 rounded-tile bg-surface/70 px-1 py-2 text-center">
          <div className="font-display text-2xl leading-none tabular-nums text-ink">
            {String(p.v).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[13px] text-peach-ink">{p.label}</div>
        </div>
      ))}
    </div>
  );
}
