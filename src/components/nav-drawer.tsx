"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import useSWR from "swr";

import { Drawer } from "@/components/modal";
import { UserAvatar } from "@/components/user-avatar";
import { fetcher, swrConfig } from "@/lib/api";
import { SECONDARY, badgeFor, isActive, type Unread } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Me = {
  user: { id: number; name: string; slug: string; avatarUrl: string | null };
  unreadMentions: Unread;
};

/**
 * The five screens that no longer fit on the bottom bar, plus a shortcut to
 * your own account.
 *
 * Reads the same `/api/me` key the bar and the dashboard already poll, so the
 * badges here cost no extra request.
 */
export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useSWR<Me>("/api/me", fetcher, swrConfig);
  const pathname = usePathname();

  // Tapping a link navigates; the drawer should not still be sitting on top of
  // where you landed. Keyed off a *change* of pathname rather than `open`, so
  // opening the drawer does not immediately close it again.
  const landedOn = useRef(pathname);
  useEffect(() => {
    if (landedOn.current === pathname) return;
    landedOn.current = pathname;
    onClose();
  }, [pathname, onClose]);

  return (
    <Drawer open={open} onClose={onClose} title="תפריט">
      <nav className="space-y-1">
        {SECONDARY.map(({ href, label, Icon }) => {
          const badge = badgeFor(href, data?.unreadMentions);
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "tap flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
                active ? "bg-brand-500/12 text-brand-200" : "text-white/70 active:bg-white/5",
              )}
            >
              <Icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 1.9} />
              <span className="flex-1 text-sm font-semibold">{label}</span>
              {badge > 0 && (
                <span
                  aria-label="יש תגובה שמחכה לך"
                  className="grid size-5 place-items-center rounded-full bg-brand-500 text-[10px] font-bold tabular-nums text-white"
                >
                  {badge}
                </span>
              )}
              <ChevronLeft className="size-4 shrink-0 text-white/20 ltr:rotate-180" />
            </Link>
          );
        })}
      </nav>

      {data && (
        <>
          <hr className="my-4 border-white/10" />
          <Link
            href="/me"
            className="tap flex items-center gap-3 rounded-2xl px-3 py-2 active:bg-white/5"
          >
            <UserAvatar
              name={data.user.name}
              slug={data.user.slug}
              avatarUrl={data.user.avatarUrl}
              size={36}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{data.user.name}</span>
              <span className="block text-[11px] text-white/40">ההגדרות שלי</span>
            </span>
          </Link>
        </>
      )}
    </Drawer>
  );
}
