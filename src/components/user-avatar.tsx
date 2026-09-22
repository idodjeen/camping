"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { celebrate } from "@/lib/confetti";
import { gradientFor, initialFor } from "@/lib/gradient";
import { cn } from "@/lib/utils";

/**
 * Avatar with a graceful fallback, optionally tappable to view full size.
 *
 * Avatar files are optional — they live at /public/avatars/{slug}.jpg and may
 * simply not exist yet. A plain <img> is used rather than next/image precisely
 * so that a 404 fires onError and we can swap in the deterministic gradient
 * initial. next/image would render a broken optimizer request instead.
 */
export function UserAvatar({
  name,
  slug,
  avatarUrl,
  size = 36,
  className,
  title,
  expandable = false,
}: {
  name: string;
  slug: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  title?: string;
  /** Tap to open the photo full size with a confetti burst. */
  expandable?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  // onError alone is not enough. The <img> is server-rendered, so a 404 can
  // fire and finish before React hydrates — the handler is attached too late
  // and the broken-image icon stays on screen. Re-check on mount: an image
  // that has finished loading with zero natural width has failed.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  const showImage = Boolean(avatarUrl) && !failed;
  // Only a real photo is worth expanding; a gradient initial has nothing to show.
  const canExpand = expandable && showImage;

  const inner = showImage ? (
    <img
      ref={imgRef}
      src={avatarUrl!}
      alt={name}
      width={size}
      height={size}
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    initialFor(name)
  );

  const shared = cn(
    "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-night-900",
    !showImage && `bg-gradient-to-br ${gradientFor(slug)}`,
    className,
  );
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  if (!canExpand) {
    return (
      <span title={title ?? name} style={style} className={shared}>
        {inner}
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef as React.RefObject<HTMLButtonElement>}
        type="button"
        title={title ?? name}
        aria-label={`להגדיל את התמונה של ${name}`}
        style={style}
        className={cn(shared, "cursor-pointer transition active:scale-90")}
        onClick={() => {
          setOpen(true);
          celebrate(triggerRef.current);
        }}
      >
        {inner}
      </button>

      <Lightbox
        open={open}
        onClose={() => setOpen(false)}
        src={avatarUrl!}
        name={name}
      />
    </>
  );
}

function Lightbox({
  open,
  onClose,
  src,
  name,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  name: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape to close, and lock background scrolling while the overlay is up.
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

  // Portalled to <body> so the overlay is never clipped by a card's
  // overflow-hidden or trapped beneath the fixed bottom nav.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`התמונה של ${name}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-night-950/85 p-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.82, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xs"
          >
            <img
              src={src}
              alt={name}
              className="w-full rounded-3xl object-cover shadow-2xl ring-1 ring-white/15"
            />
            <p className="mt-3 text-center text-lg font-bold">{name}</p>

            <button
              onClick={onClose}
              aria-label="לסגור"
              className="tap absolute -top-3 -end-3 grid place-items-center rounded-full border border-white/15 bg-night-800 text-white/70 shadow-lg active:scale-90"
            >
              <X className="size-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
