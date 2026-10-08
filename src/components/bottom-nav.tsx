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
 * Its height is --bottom-nav-h (globals.css), which the layout's padding and
 * the room composer also read. The room sets data-keyboard="open" on <html>
 * while the keyboard is up, which hides the bar and zeroes that variable.
 */
export function BottomNav() {
  const { page, local } = useTrip();
  // Tabs are compared as short paths ("/gear"), whatever trip this is.
  const pathname = local(usePathname());
  // The bell's own poll, so the badges cost no extra request.
  const unread = useInbox().data?.counts.tags;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 h-(--bottom-nav-h) border-t border-white/10 bg-night-950/80 backdrop-blur-xl in-data-[keyboard=open]:hidden">
      <div
        className="mx-auto flex h-full max-w-md items-stretch justify-between px-3 pt-1.5"
        // Clears the iPhone home indicator; harmless zero on other devices.
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.375rem)" }}
      >
        {PRIMARY.map(({ href, label, Icon }) => {
          const active = isActive(href, pathname);
          const badge = badgeFor(href, unread);
          return (
            <Link
              key={href}
              href={page(href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "tap relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors",
                active ? "text-brand-300" : "text-white/45 active:text-white/70",
              )}
            >
              {active && (
                // layoutId lets the pill slide between tabs instead of blinking.
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-xl bg-brand-500/12"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                />
              )}
              <span className="relative">
                <Icon className="size-5" strokeWidth={active ? 2.5 : 1.9} />
                {badge > 0 && (
                  <span
                    aria-label="יש תגובה שמחכה לך"
                    className="absolute -end-2 -top-1 grid size-4 place-items-center rounded-full bg-brand-500 text-[9px] font-bold text-white ring-2 ring-night-950"
                  >
                    {badge}
                  </span>
                )}
              </span>
              <span className="relative text-[11px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
