"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";

import { fetcher, swrConfig } from "@/lib/api";
import { PRIMARY, badgeFor, isActive, type Unread } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  // Same SWR key the dashboard and profile already poll, so this is free there
  // and one shared request elsewhere.
  const { data } = useSWR<{ unreadMentions: Unread }>("/api/me", fetcher, swrConfig);
  const unread = data?.unreadMentions;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night-950/80 backdrop-blur-xl">
      <div
        className="mx-auto flex max-w-md items-stretch justify-between px-1 pt-1.5"
        // Clears the iPhone home indicator; harmless zero on other devices.
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.375rem)" }}
      >
        {PRIMARY.map(({ href, label, Icon }) => {
          const active = isActive(href, pathname);
          const badge = badgeFor(href, unread);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "tap relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors",
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
                <Icon className="size-[22px]" strokeWidth={active ? 2.5 : 1.9} />
                {badge > 0 && (
                  <span
                    aria-label="יש תגובה שמחכה לך"
                    className="absolute -end-1.5 -top-1 grid size-4 place-items-center rounded-full bg-brand-500 text-[9px] font-bold text-white ring-2 ring-night-950"
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
