import confetti from "canvas-confetti";

/**
 * Burst from a specific element rather than the middle of the screen, so the
 * celebration reads as coming from the checkbox you just tapped.
 */
export function burstFrom(el: Element | null, opts?: { small?: boolean }) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rect = el?.getBoundingClientRect();
  const origin = rect
    ? {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      }
    : { x: 0.5, y: 0.5 };

  confetti({
    origin,
    particleCount: opts?.small ? 18 : 55,
    spread: opts?.small ? 45 : 70,
    startVelocity: opts?.small ? 18 : 30,
    gravity: 0.9,
    scalar: opts?.small ? 0.7 : 0.9,
    ticks: 120,
    disableForReducedMotion: true,
    colors: ["#a78bfa", "#60a5fa", "#2dd4bf", "#c4b5fd", "#5eead4"],
  });
}

/**
 * A bigger, screen-filling celebration: a burst at the origin plus two angled
 * volleys from the lower corners, so it reads across the whole viewport rather
 * than as a single puff.
 */
export function celebrate(el: Element | null) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const colors = ["#a78bfa", "#60a5fa", "#2dd4bf", "#c4b5fd", "#5eead4", "#f0abfc"];
  const rect = el?.getBoundingClientRect();
  const origin = rect
    ? {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      }
    : { x: 0.5, y: 0.4 };

  confetti({ origin, particleCount: 70, spread: 100, startVelocity: 34, scalar: 1, colors, ticks: 180, disableForReducedMotion: true });
  setTimeout(() => {
    confetti({ origin: { x: 0, y: 0.75 }, angle: 55, particleCount: 45, spread: 65, startVelocity: 48, colors, ticks: 200, disableForReducedMotion: true });
    confetti({ origin: { x: 1, y: 0.75 }, angle: 125, particleCount: 45, spread: 65, startVelocity: 48, colors, ticks: 200, disableForReducedMotion: true });
  }, 140);
}
