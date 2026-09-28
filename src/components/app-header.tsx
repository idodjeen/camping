"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { NavDrawer } from "@/components/nav-drawer";
import { NotificationsBell } from "@/components/notifications";
import { fetcher, swrConfig } from "@/lib/api";
import { menuBadge, type Unread } from "@/lib/nav";

/**
 * The one header every signed-in screen carries: menu, name, bell.
 *
 * The children are laid out in reading order and the browser decides which
 * physical edge each lands on, so in Hebrew the menu opens from the right and
 * would move to the left on its own if the document ever turned LTR. Nothing
 * in here names a physical side.
 *
 * The bell used to appear only on the dashboard and the account screen. With
 * five destinations behind the menu it has to be reachable from all of them,
 * so it lives here now.
 */
export function AppHeader() {
  const [open, setOpen] = useState(false);
  const { data } = useSWR<{ unreadMentions: Unread }>("/api/me", fetcher, swrConfig);
  const waiting = menuBadge(data?.unreadMentions);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night-950/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        {/* h-14 matches --app-header-h in globals.css. */}
        <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-5">
          <button
            onClick={() => setOpen(true)}
            aria-label={waiting > 0 ? `תפריט — ${waiting} ממתינות` : "תפריט"}
            aria-expanded={open}
            className="tap relative grid place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition active:scale-95"
          >
            <Menu className="size-[18px]" />
            {waiting > 0 && (
              <span
                aria-hidden
                className="absolute end-1 top-1 size-2 rounded-full bg-brand-500 ring-2 ring-night-950"
              />
            )}
          </button>

          <p className="min-w-0 flex-1 truncate text-sm font-bold text-white/80">מחנאות 2026</p>

          <NotificationsBell />
        </div>
      </header>

      <NavDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
