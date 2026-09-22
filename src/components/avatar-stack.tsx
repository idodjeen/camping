"use client";

import { AnimatePresence, motion } from "framer-motion";

import { UserAvatar } from "@/components/user-avatar";

export type StackEntry = {
  userId: number;
  name: string;
  slug: string;
  avatarUrl: string | null;
  qty: number;
};

/**
 * Overlapping avatars of everyone who claimed an item. Each pops in with a
 * spring the moment its claim lands, so a teammate's claim arriving on the
 * 15-second poll is visible rather than silently appearing.
 */
export function AvatarStack({ entries, size = 30 }: { entries: StackEntry[]; size?: number }) {
  return (
    <div className="flex flex-row-reverse items-center">
      <AnimatePresence initial={false}>
        {entries.map((e) => (
          <motion.span
            key={e.userId}
            layout
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 22 }}
            className="relative -ms-2 first:ms-0"
          >
            <UserAvatar
              name={e.name}
              slug={e.slug}
              avatarUrl={e.avatarUrl}
              size={size}
              title={e.qty > 1 ? `${e.name} · ${e.qty}` : e.name}
            />
            {e.qty > 1 && (
              <span className="absolute -bottom-1 -start-1 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-night-900">
                {e.qty}
              </span>
            )}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
