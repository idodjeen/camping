"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Body scroll lock shared by every overlay, counted rather than saved and
 * restored. With save/restore, two overlays closing out of order (the bell
 * pane handing over to a thread sheet, say) let the second one "restore" the
 * first one's `hidden`, and the page stayed frozen after both were gone.
 * Here only the first lock writes and only the last release puts it back.
 */
let locks = 0;
let saved = "";

function lockScroll() {
  if (locks++ === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) document.body.style.overflow = saved;
  };
}

/** Open overlays, oldest first, so Escape closes only the one on top. */
const stack: symbol[] = [];

/**
 * What every overlay here needs: mount only on the client (there is no
 * <body> to portal into during SSR), close on Escape, and lock background
 * scroll while open. Returns whether it is safe to portal yet.
 */
export function useOverlay(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Callers pass inline arrows; reading the latest one through a ref keeps the
  // lock from being released and retaken on every parent render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol();
    stack.push(id);
    const release = lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack.at(-1) === id) close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      stack.splice(stack.indexOf(id), 1);
      release();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return mounted;
}
