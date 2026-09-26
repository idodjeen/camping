"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The parts every overlay here shares: mount only on the client (nothing to
 * portal into during SSR), close on Escape, and lock background scroll while
 * open — a dialog you can scroll the page behind is a dialog you lose.
 */
function useOverlay(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return mounted;
}

/**
 * Centred modal sheet.
 *
 * Portalled to <body> so it is never clipped by a card's overflow-hidden or
 * trapped beneath the fixed bottom nav. Closes on the backdrop, the ✕, or
 * Escape, and locks background scroll while open — an explanation that pushes
 * the page longer and makes you scroll to find it is worse than no
 * explanation at all.
 */
export function Modal({
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
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[65] flex items-center justify-center bg-night-950/85 p-5 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="glass max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-glass p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <h2 className="flex-1 text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="לסגור"
                className="tap grid place-items-center rounded-xl text-white/45 active:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Side sheet pinned to the inline-start edge — the right in Hebrew, the left
 * if the document ever turns LTR.
 *
 * The panel is placed with logical properties so the browser picks the side,
 * but framer-motion's `x` is physical, so the slide direction is read off the
 * document at open time. Dragging it back towards its own edge closes it, the
 * same gesture the onboarding cards use.
 */
export function Drawer({
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
  if (!mounted) return null;

  // Off-screen is +100% when the panel hangs off the right edge, -100% off the left.
  const rtl = document.documentElement.dir !== "ltr";
  const hidden = rtl ? "100%" : "-100%";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[65] bg-night-950/70 backdrop-blur-md"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: hidden }}
            animate={{ x: 0 }}
            exit={{ x: hidden }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            drag="x"
            dragElastic={0.06}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              // Past a third of the panel, or flicked hard, towards its own edge.
              const away = rtl ? info.offset.x : -info.offset.x;
              const flick = rtl ? info.velocity.x : -info.velocity.x;
              if (away > 90 || flick > 500) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ insetInlineStart: 0 }}
            className="absolute top-0 flex h-dvh w-[78vw] max-w-xs flex-col border-white/10 bg-night-950/95 shadow-2xl backdrop-blur-xl border-e"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
              <h2 className="flex-1 text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="לסגור"
                className="tap grid place-items-center rounded-xl text-white/45 active:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
