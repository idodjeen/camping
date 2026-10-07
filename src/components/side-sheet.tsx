"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

import { useOverlay } from "@/lib/use-overlay";
import { startSign } from "@/lib/utils";

/**
 * Full-height sheet pinned to the inline-start edge: the right in Hebrew, the
 * left if the document ever turns LTR.
 *
 * The panel is placed with `start-0`, so the browser picks the side, but
 * framer-motion's `x` is physical, so the slide reads the direction from the
 * document. Closes on the backdrop, the ✕, Escape, or a swipe back toward its
 * own edge. With reduced motion it fades in place instead of sliding.
 *
 * Portalled to <body>: anything fixed inside a page would be trapped by the
 * template's transform.
 */
export function SideSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const mounted = useOverlay(open, onClose);
  const reduce = useReducedMotion();
  if (!mounted) return null;

  // +1 in RTL: the start edge is on the right, so off-screen is +100%.
  const sign = startSign();
  const away = reduce ? 0 : `${sign * 100}%`;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[65] bg-night-950/70 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: away, opacity: reduce ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: away, opacity: reduce ? 0 : 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag={reduce ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            // Follows the finger toward its own edge, resists the other way.
            dragElastic={sign > 0 ? { left: 0, right: 0.9 } : { left: 0.9, right: 0 }}
            onDragEnd={(_, info) => {
              const toward = sign * info.offset.x;
              const flick = sign * info.velocity.x;
              if (toward > 80 || flick > 500) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 start-0 flex w-[80vw] max-w-xs flex-col border-e border-white/10 bg-night-900/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 border-b border-white/10 ps-5 pe-3 pt-[env(safe-area-inset-top,0px)]">
              <h2 className="flex-1 py-3 text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="לסגור"
                className="tap grid place-items-center rounded-xl text-white/45 active:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
