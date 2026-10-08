"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useInbox } from "@/lib/inbox-client";
import { PRIMARY, badgeFor, isActive } from "@/lib/nav";
import { useTrip } from "@/lib/trip-client";
import { cn } from "@/lib/utils";

/**
 * The primary tabs from lib/nav.ts; the other screens are in the header's menu.
 *
 * A dark pill that floats over the page in both themes. The tab you are on
 * shows its name; the others are icons with an aria-label, so the bar stays
 * calm with three tabs or five.
 *
 * Its height, gap and safe-area inset add up to --bottom-nav-h (globals.css),
 * which the layout's padding and the room composer also read. The room sets
 * data-keyboard="open" on <html> while the keyboard is up, which hides the
 * bar and zeroes that variable.
 */
export function BottomNav() {
  const { page, local } = useTrip();
  // Tabs are compared as short paths ("/gear"), whatever trip this is.
  const pathname = local(usePathname());
  // The bell's own poll, so the badges cost no extra request.
  const unread = useInbox().data?.counts.tags;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex h-(--bottom-nav-h) items-end px-4 in-data-[keyboard=open]:hidden"
      // Clears the iPhone home indicator; harmless zero on other devices.
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="pointer-events-auto mx-auto flex h-17 w-full max-w-md items-center justify-around rounded-full bg-nav px-2.5 shadow-[0_10px_30px_var(--c-shadow)]">
        {PRIMARY.map(({ href, label, Icon }) => {
          const active = isActive(href, pathname);
          const badge = badgeFor(href, unread);
          return (
            <Link
              key={href}
              href={page(href)}
              aria-current={active ? "page" : undefined}
              aria-label={active ? undefined : badge > 0 ? `${label}, ${badge} חדשות` : label}
              className={cn(
                "tap relative flex h-12 items-center justify-center gap-2 rounded-full transition-colors",
                active ? "px-5 text-nav-active-ink" : "w-12 text-nav-icon active:text-nav-active",
              )}
            >
              {active && (
                // layoutId lets the pill slide between tabs instead of blinking.
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-nav-active"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                />
              )}
              <span className="relative">
                <Icon className={active ? "size-5" : "size-6"} strokeWidth={2} />
                {badge > 0 && (
                  <span
                    aria-hidden
                    className="absolute -end-2.5 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-badge px-1 text-[11px] font-bold tabular-nums text-on-badge"
                  >
                    {badge}
                  </span>
                )}
              </span>
              {active && <span className="relative text-[15px] font-bold leading-none">{label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
