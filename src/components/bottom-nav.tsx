"use client";

import { motion } from "framer-motion";
import { Backpack, Home, ShoppingCart, User, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "בית", Icon: Home },
  { href: "/gear", label: "ציוד", Icon: Backpack },
  { href: "/meals", label: "ארוחות", Icon: UtensilsCrossed },
  { href: "/shopping", label: "קניות", Icon: ShoppingCart },
  { href: "/me", label: "שלי", Icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night-950/80 backdrop-blur-xl">
      <div
        className="mx-auto flex max-w-md items-stretch justify-between px-2 pt-1.5"
        // Clears the iPhone home indicator; harmless zero on other devices.
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.375rem)" }}
      >
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "tap relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors",
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
              <Icon className="relative size-5" strokeWidth={active ? 2.4 : 1.9} />
              <span className="relative text-[11px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
