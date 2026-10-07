"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ORDER, navHref } from "@/lib/nav";
import { useTrip } from "@/lib/trip-client";
import { startSign } from "@/lib/utils";

// Survives remounts (a template is re-created on every navigation).
let lastIndex = 0;
// False until the first page has hydrated. The server renders with its own
// copy of lastIndex, shared by every request, so a direction computed there
// can disagree with the browser's and break hydration. The first render
// therefore never slides; only in-app navigations do.
let hydrated = false;

/**
 * Unlike a layout, a template remounts on each navigation, so the enter
 * animation replays for every page. The page slides in from the side of the
 * screen you are heading to (later screens in lib/nav.ts sit toward the
 * inline end), with a soft blur and scale-up to make it feel like it lands.
 *
 * The header and every other fixed bar stay in the layout, outside this:
 * the transform and the leftover `filter: blur(0px)` make this wrapper the
 * containing block of any `position: fixed` child.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = useTrip().local(usePathname());
  const reduce = useReducedMotion();

  const idx = ORDER.indexOf(navHref(pathname));
  const dir = !hydrated || idx === -1 || idx === lastIndex ? 0 : idx > lastIndex ? -1 : 1;
  // Updated after commit, never during render: React may render this twice
  // (Strict Mode in dev, retried transitions anywhere), and a second render
  // would read the new tab as "last" and lose the slide. Effects also never
  // run on the server, so its copy of lastIndex is never touched.
  useEffect(() => {
    hydrated = true;
    if (idx !== -1) lastIndex = idx;
  }, [idx]);

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, x: dir * 32 * startSign(), y: dir === 0 ? 12 : 0, scale: 0.97, filter: "blur(6px)" }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.9 }}
    >
      {children}
    </motion.div>
  );
}
