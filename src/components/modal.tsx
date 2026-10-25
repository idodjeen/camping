"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/ui/button";
import { useOverlay } from "@/lib/use-overlay";

/**
 * The bottom sheet every pop-up uses (the "חלון מלמטה" of the states board):
 * it rises from the bottom over a dimmed page, and closes on the backdrop,
 * the ✕, Escape, or a drag down from its handle or title. With reduced
 * motion it fades in place.
 *
 * Portalled to <body> so it is never clipped by a card's overflow-hidden or
 * trapped under the tab bar. Pinned to the bottom edge, it sits right above
 * the on-screen keyboard (as the general chat's composer does), and its
 * height is capped in dvh so a composer inside stays visible.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** A quiet line above the title, like "תגובות" over the item's name. */
  eyebrow?: string;
  /**
   * Pinned under the scrolling content, like a thread's composer: it never
   * scrolls away, and it takes over the bottom safe-area padding.
   */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const mounted = useOverlay(open, onClose);
  const reduce = useReducedMotion();
  // Only the handle and the title row start a drag, so the content can scroll.
  const drag = useDragControls();
  if (!mounted) return null;

  const away = reduce ? 0 : "100%";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[65] bg-scrim"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: away, opacity: reduce ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: away, opacity: reduce ? 0 : 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag={reduce ? false : "y"}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.8 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-[34px] bg-canvas shadow-[0_-10px_40px_var(--c-shadow)]"
          >
            <div
              onPointerDown={(e) => drag.start(e)}
              className="shrink-0 touch-none px-5 pt-2.5 pb-3.5"
            >
              <div aria-hidden className="mx-auto mb-3 h-[5px] w-11 rounded-full bg-line" />
              <div className="flex items-center gap-2.5">
                <div className="min-w-0 flex-1 leading-tight">
                  {eyebrow && <p className="text-[13px] text-muted">{eyebrow}</p>}
                  <h2 className="truncate font-display text-[22px]">{title}</h2>
                </div>
                <IconButton
                  aria-label="סגירה"
                  onClick={onClose}
                  // A tap on the button must not start a drag.
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <X className="size-5" />
                </IconButton>
              </div>
            </div>
            <div
              className={
                footer
                  ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4"
                  : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]"
              }
            >
              {children}
            </div>
            {footer && (
              <div className="shrink-0 border-t-[1.5px] border-line px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
