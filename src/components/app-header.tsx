"use client";

import { Check, ChevronDown, ChevronLeft, Menu } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { Modal } from "@/components/modal";
import { NotificationsBell } from "@/components/notifications";
import { SideSheet } from "@/components/side-sheet";
import { fetcher, swrConfig } from "@/lib/api";
import { SECONDARY, badgeFor, canSee, isActive, menuBadge, type MenuRoles, type Unread } from "@/lib/nav";
import { useTrip } from "@/lib/trip-client";
import { cn } from "@/lib/utils";

/** A trip the switcher can open; the layout loads the list on the server. */
export type TripOption = { id: number; name: string; groupId: number; groupName: string };

type Me = { user: { isAdmin: boolean; isSuperAdmin: boolean }; unreadMentions: Unread };

/**
 * The header on every trip screen: the menu at the start edge, the group and
 * trip in the middle, the bell at the end edge. Children are in reading order
 * and nothing names a physical side, so the browser places them for RTL.
 *
 * Lives in the trip layout, outside template.tsx, so it never slides with the
 * page and its sheets are never trapped by the template's transform. Its
 * height is --app-header-h (globals.css), which the bars that park under it
 * also read.
 */
export function AppHeader({ trips }: { trips: TripOption[] }) {
  const { api } = useTrip();
  // Same key the bottom nav polls, so the badge costs no extra request.
  const { data } = useSWR<Me>(api("/me"), fetcher, swrConfig);
  const [menu, setMenu] = useState(false);
  const roles: MenuRoles = {
    isAdmin: data?.user.isAdmin ?? false,
    isSuperAdmin: data?.user.isSuperAdmin ?? false,
  };
  const waiting = menuBadge(data?.unreadMentions, roles);

  return (
    <>
      <header className="sticky top-0 z-30 h-(--app-header-h) border-b border-white/10 bg-night-950/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-md items-center gap-2 px-3">
          <button
            onClick={() => setMenu(true)}
            aria-label={waiting > 0 ? `תפריט, ${waiting} ממתינות` : "תפריט"}
            aria-expanded={menu}
            aria-haspopup="dialog"
            className="tap relative grid shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition active:scale-95"
          >
            <Menu className="size-[18px]" />
            {waiting > 0 && (
              <span className="absolute end-1 top-1 grid size-[17px] place-items-center rounded-full bg-brand-500 text-[9px] font-bold tabular-nums text-white ring-2 ring-night-950">
                {waiting}
              </span>
            )}
          </button>

          <TripSwitcher trips={trips} />

          <div className="shrink-0">
            <NotificationsBell />
          </div>
        </div>
      </header>

      <SideSheet open={menu} onClose={() => setMenu(false)} title="תפריט">
        <NavMenu data={data} roles={roles} onPick={() => setMenu(false)} />
      </SideSheet>
    </>
  );
}

/** The screens that are not bottom tabs, each with its own badge. */
function NavMenu({
  data,
  roles,
  onPick,
}: {
  data: Me | undefined;
  roles: MenuRoles;
  onPick: () => void;
}) {
  const { page, local } = useTrip();
  const pathname = local(usePathname());

  return (
    <nav className="space-y-1">
      {SECONDARY.filter((n) => canSee(n, roles)).map(({ href, label, Icon, outsideTrip }) => {
        const active = !outsideTrip && isActive(href, pathname);
        const badge = badgeFor(href, data?.unreadMentions);
        return (
          <Link
            key={href}
            href={outsideTrip ? (href as Route) : page(href)}
            // Closes from the tap itself, not on a pathname change, so tapping
            // the screen you are already on closes the menu too.
            onClick={onPick}
            aria-current={active ? "page" : undefined}
            className={cn(
              "tap flex items-center gap-3 rounded-2xl px-3 transition-colors",
              active ? "bg-brand-500/12 text-brand-200" : "text-white/75 active:bg-white/5",
            )}
          >
            <Icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 1.9} />
            <span className="flex-1 text-sm font-semibold">{label}</span>
            {badge > 0 && (
              <span
                aria-label={badge === 1 ? "תיוג אחד מחכה לך" : `${badge} תיוגים מחכים לך`}
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
  );
}

/**
 * The group and trip you are in. With more than one trip it opens a list by
 * group; picking one opens that trip's home.
 */
function TripSwitcher({ trips }: { trips: TripOption[] }) {
  const { id } = useTrip();
  const [open, setOpen] = useState(false);
  const current = trips.find((t) => t.id === id);

  const label = (
    <span className="min-w-0 text-center leading-tight">
      {current && (
        <span className="block truncate text-[10px] font-semibold text-white/40">
          {current.groupName}
        </span>
      )}
      <span className="block truncate text-sm font-bold text-white/85">
        {current?.name ?? "הטיול"}
      </span>
    </span>
  );

  if (trips.length < 2) {
    return <div className="flex min-w-0 flex-1 justify-center px-1">{label}</div>;
  }

  const byGroup = new Map<number, TripOption[]>();
  for (const t of trips) byGroup.set(t.groupId, [...(byGroup.get(t.groupId) ?? []), t]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${current?.name ?? "הטיול"}, להחליף טיול`}
        className="tap flex min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-1 transition active:scale-[0.98]"
      >
        {label}
        <ChevronDown className="size-4 shrink-0 text-white/35" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="הטיולים שלי">
        <div className="space-y-4">
          {[...byGroup.values()].map((list) => (
            <section key={list[0].groupId}>
              <h3 className="mb-1.5 text-xs font-semibold text-white/45">{list[0].groupName}</h3>
              <ul className="space-y-1">
                {list.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/t/${t.id}`}
                      onClick={() => setOpen(false)}
                      aria-current={t.id === id ? "page" : undefined}
                      className={cn(
                        "tap flex items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors",
                        t.id === id ? "bg-brand-500/12 text-brand-200" : "text-white/75 active:bg-white/5",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      {t.id === id && <Check className="size-4 shrink-0" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Modal>
    </>
  );
}
