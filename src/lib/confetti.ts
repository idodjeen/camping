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
