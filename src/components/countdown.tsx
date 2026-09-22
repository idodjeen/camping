"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown to the trip, in Israel time.
 *
 * Renders nothing until mounted. The server and the browser would otherwise
 * compute a different "now" milliseconds apart, and React would flag a
 * hydration mismatch on a value that is different by definition on every tick.
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
    return <div className="h-[4.5rem] animate-pulse rounded-xl bg-white/5" aria-hidden />;
  }

  if (left <= 0) {
    return (
      <p className="py-3 text-2xl font-black text-aqua-300">יאללה, אנחנו בטיול 🔥</p>
    );
  }

  const s = Math.floor(left / 1000);
  const parts = [
    { v: Math.floor(s / 86400), label: "ימים" },
    { v: Math.floor((s % 86400) / 3600), label: "שעות" },
    { v: Math.floor((s % 3600) / 60), label: "דקות" },
    { v: s % 60, label: "שניות" },
  ];

  return (
    <div className="flex items-start justify-center gap-3" dir="rtl">
      {parts.map((p) => (
        <div key={p.label} className="min-w-[3.25rem]">
          <div className="text-3xl font-black tabular-nums leading-none">
            {String(p.v).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[11px] text-white/45">{p.label}</div>
        </div>
      ))}
    </div>
  );
}
