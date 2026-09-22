"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Minimal toast. Server-side permission failures (a non-shopper trying to tick
 * an item, a lost race for the last gas stove) come back as Hebrew messages —
 * this is how the user actually sees them instead of a silent no-op.
 */
type Toast = { id: number; text: string; tone: "error" | "ok" };

const EVENT = "camping:toast";
let seq = 0;

export function toast(text: string, tone: Toast["tone"] = "error") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: ++seq, text, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      setItems((cur) => [...cur, t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 3200);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className={`glass max-w-sm rounded-2xl px-4 py-2.5 text-sm font-medium ${
              t.tone === "error" ? "text-rose-200" : "text-aqua-300"
            }`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
