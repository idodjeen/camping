"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal toast. Server-side permission failures (a non-shopper trying to tick
 * an item, a lost race for the last gas stove) come back as Hebrew messages:
 * this is how the user actually sees them instead of a silent no-op.
 *
 * Per the states board it rises from the bottom, just above the tab bar (or
 * the keyboard, which zeroes the bar's height), and leaves after 3 seconds.
 * "ok" is the dark pill with a green tick; "error" is rose with an alert icon.
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
    <div
      role="status"
      aria-live="polite"
      // Above sheets and the confirm dialog: a toast from inside one must show.
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+0.75rem)] z-[80] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className={cn(
              "flex max-w-sm items-center gap-2.5 rounded-[22px] px-4 py-3 text-[15px] font-semibold",
              t.tone === "ok"
                ? "bg-ink text-canvas shadow-[0_8px_24px_var(--c-shadow)]"
                : "bg-rose text-rose-ink",
            )}
          >
            {t.tone === "ok" ? (
              <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-sage-strong text-canvas">
                <Check className="size-[15px]" strokeWidth={3} />
              </span>
            ) : (
              <AlertCircle aria-hidden className="size-[22px] shrink-0 text-rose-strong" />
            )}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
