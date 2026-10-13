"use client";

/**
 * How long a tap on a tab, a menu row or a filter chip takes to show the new
 * screen and then its content, on real phones (perf sprint P02).
 *
 * markTap() runs on the tap. It notes when the URL changes ("commit") and
 * when the new screen has no loading placeholders left ("content"), then
 * sends one line to /api/timing, which only logs it: read them with
 * `vercel logs --environment production | grep tap-timing`. The last 50 also
 * stay in `window.__tapTimes` for a look in devtools.
 *
 * Content means "the screen's wrapper (template.tsx's `.page-in`) holds no
 * `.animate-pulse` placeholder", which is how every trip screen draws its
 * loading state.
 */

type Kind = "tab" | "menu" | "chip";

export type TapTiming = {
  to: string;
  from: string;
  kind: Kind;
  commitMs: number | null;
  contentMs: number | null;
  standalone: boolean;
};

const KEEP = 50;
const GIVE_UP_MS = 10_000;

/** A newer tap replaces one still being watched. */
let generation = 0;

/** "/t/7/gear?filter=todo" -> "/t/:id/gear?filter=todo": no ids leave the phone. */
const shape = (url: string) => url.replace(/^\/(t|g)\/\d+/, "/$1/:id");

export function markTap(to: string, kind: Kind) {
  if (typeof window === "undefined") return;
  const from = location.pathname + location.search;
  if (to === from) return;

  const gen = ++generation;
  const t0 = performance.now();
  let commit: number | null = null;

  const finish = (content: number | null) => {
    const timing: TapTiming = {
      to: shape(to),
      from: shape(from),
      kind,
      commitMs: commit === null ? null : Math.round(commit - t0),
      contentMs: content === null ? null : Math.round(content - t0),
      standalone: matchMedia("(display-mode: standalone)").matches,
    };
    const w = window as unknown as { __tapTimes?: TapTiming[] };
    const recent = (w.__tapTimes ??= []);
    recent.push(timing);
    if (recent.length > KEEP) recent.shift();
    if (timing.commitMs !== null) navigator.sendBeacon?.("/api/timing", JSON.stringify(timing));
  };

  const check = () => {
    if (gen !== generation) return;
    const now = performance.now();
    if (now - t0 > GIVE_UP_MS) return finish(null);
    if (commit === null && location.pathname + location.search === to) commit = now;
    if (commit !== null) {
      const screen = document.querySelector(".page-in");
      if (screen && !screen.querySelector(".animate-pulse") && screen.textContent?.trim()) return finish(now);
    }
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}
