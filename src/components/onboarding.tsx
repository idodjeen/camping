"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { send } from "@/lib/api";
import { celebrate } from "@/lib/confetti";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    emoji: "🏕️",
    title: "מחנאות 2026",
    body: "שלושה ימים בגליל העליון. כאן מרכזים מי מביא מה, מה אוכלים, ומה עוד צריך לקנות — בלי לחפור בוואטסאפ.",
  },
  {
    emoji: "🎒",
    title: "תופסים ציוד",
    body: "במסך הציוד רואים מה עוד חסר ולוחצים “אני מביא”. אפשר לקחת חלק מכמות — למשל בלון גז אחד מתוך ארבעה — ותמיד אפשר לוותר.",
  },
  {
    emoji: "🔥",
    title: "ארוחות וקניות",
    body: "לכל ארוחה יש רשימת מצרכים משלה. עידו וניר מסמנים מה כבר נקנה, וכולם רואים את זה מתעדכן בזמן אמת.",
  },
  {
    emoji: "🎯",
    title: "הרשימה שלך",
    body: "במסך הציוד מסמנים מה כבר ארוז, ומנהלים רשימה אישית ופרטית — מברשת שיניים, תרופות, מה שלא יהיה. אף אחד אחר לא רואה אותה.",
  },
];

export function Onboarding({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const last = i === CARDS.length - 1;

  const go = (next: number) => {
    if (next < 0 || next >= CARDS.length) return;
    setDir(next > i ? 1 : -1);
    setI(next);
  };

  async function finish(el: Element | null) {
    celebrate(el);
    onDone();
    // Fire-and-forget: the overlay should close instantly. If this fails the
    // cards simply reappear next visit, which is a harmless outcome.
    void send("/api/me/onboarded", "POST").catch(() => {});
  }

  if (!open) return null;
  const card = CARDS[i];

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-center bg-night-950/92 backdrop-blur-lg">
      <div className="mx-auto w-full max-w-md p-5">
        <div className="glass glow-brand overflow-hidden rounded-glass">
          <div className="relative h-[19rem]">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.div
                key={i}
                custom={dir}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  // RTL: dragging right moves forward through the cards.
                  if (info.offset.x > 70) go(i - 1);
                  else if (info.offset.x < -70) go(i + 1);
                }}
                initial={{ opacity: 0, x: dir * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -60 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="absolute inset-0 flex cursor-grab flex-col items-center justify-center px-7 text-center active:cursor-grabbing"
              >
                <span className="text-5xl" aria-hidden>
                  {card.emoji}
                </span>
                <h2 className="mt-4 bg-gradient-to-l from-brand-300 via-ocean-400 to-aqua-300 bg-clip-text text-2xl font-bold text-transparent">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{card.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-center gap-1.5 pb-4">
            {CARDS.map((_, n) => (
              <button
                key={n}
                onClick={() => go(n)}
                aria-label={`כרטיס ${n + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  n === i ? "w-6 bg-brand-400" : "w-1.5 bg-white/20",
                )}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={(e) => (last ? finish(e.currentTarget) : go(i + 1))}
            className="tap flex-1 rounded-2xl bg-gradient-to-l from-brand-500 to-ocean-500 px-5 text-sm font-bold text-white shadow-lg transition active:scale-[0.98]"
          >
            {last ? "יאללה, בוא נתחיל" : "הבא"}
          </button>
          {!last && (
            <button
              onClick={(e) => finish(e.currentTarget)}
              className="tap rounded-2xl px-4 text-sm text-white/40"
            >
              דילוג
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Client wrapper so the server layout can decide whether to show it. */
export function OnboardingGate({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <Onboarding open={open} onDone={() => setOpen(false)} />;
}
