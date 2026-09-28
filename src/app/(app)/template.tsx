"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

// Tab order, so we know which way the page should slide in.
const ORDER = ["/", "/meals", "/gear", "/shopping", "/chat", "/leaderboard", "/me"];

// Survives remounts (a template is re-created on every navigation).
let lastIndex = 0;

/**
 * Unlike a layout, a template remounts on each navigation, so the enter
 * animation replays for every page. The page slides in from the side of the
 * tab you are heading to (the app is RTL, so later tabs sit further left),
 * with a soft blur and scale-up to make it feel like it lands.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const idx = ORDER.indexOf(pathname === "/room" ? "/chat" : pathname);
  const dir = idx === -1 || idx === lastIndex ? 0 : idx > lastIndex ? -1 : 1;
  if (idx !== -1) lastIndex = idx;

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, x: dir * 32, y: dir === 0 ? 12 : 0, scale: 0.97, filter: "blur(6px)" }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.9 }}
    >
      {children}
    </motion.div>
  );
}
