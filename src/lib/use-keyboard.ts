"use client";

import { useEffect } from "react";

/** How far the visible area must shrink before we call it a keyboard. */
const KEYBOARD_PX = 150;

/**
 * While mounted, sets <html data-keyboard="open"> whenever the on-screen
 * keyboard is up. globals.css zeroes --bottom-nav-h on it and the bottom nav
 * hides, so a composer parked at `bottom-(--bottom-nav-h)` drops to the
 * bottom edge, right above the keyboard, instead of floating a nav's height
 * over it.
 *
 * Neither iOS nor Android reports the keyboard directly. Both shrink
 * window.visualViewport, so this compares its height with the tallest it has
 * been at this width (a rotation starts over). Pinch zoom also shrinks it, so
 * a zoomed-in viewport never counts.
 */
export function useKeyboardFlag() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let width = vv.width;
    let full = vv.height;

    const update = () => {
      if (Math.abs(vv.width - width) > 1) {
        width = vv.width;
        full = vv.height;
      }
      full = Math.max(full, vv.height);
      const open = vv.scale <= 1.01 && full - vv.height > KEYBOARD_PX;
      if (open) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
    };

    update();
    vv.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      delete root.dataset.keyboard;
    };
  }, []);
}
