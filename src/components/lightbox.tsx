"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A photo at full size, over everything.
 *
 * Portalled to <body> so it is never clipped by a bubble's overflow or trapped
 * under the fixed bottom nav, and sized to the viewport rather than the image
 * so a tall portrait shot does not need scrolling to see.
 *
 * `UserAvatar` keeps its own copy of this: that one falls back to a gradient
 * initial and fires confetti, which nothing else wants.
 */
export function Lightbox({
  open,
  onClose,
  src,
  alt,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
}) {
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

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[68] flex items-center justify-center bg-night-950/92 p-4 backdrop-blur-md"
        >
          <motion.img
            src={src}
            alt={alt}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88dvh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
          <button
            onClick={onClose}
            aria-label="לסגור"
            className="tap absolute end-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] grid place-items-center rounded-full border border-white/15 bg-night-800/90 text-white/70 shadow-lg active:scale-90"
          >
            <X className="size-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
