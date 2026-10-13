"use client";

import { Check, ChevronDown, ChevronLeft, Menu, UserCog, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Modal } from "@/components/modal";
import { NotificationsBell } from "@/components/notifications";
import { SideSheet } from "@/components/side-sheet";
import { ThemeSwitch } from "@/components/theme-switch";
import { useInbox } from "@/lib/inbox-client";
import {
  SECONDARY,
  badgeFor,
  canSee,
  isActive,
  menuBadge,
  type MenuRoles,
  type NavItem,
  type Unread,
} from "@/lib/nav";
import { markTap } from "@/lib/tap-timer";
import { useTrip } from "@/lib/trip-client";
import { cn } from "@/lib/utils";

/** A trip the switcher can open; the layout loads the list on the server. */
export type TripOption = { id: number; name: string; groupId: number; groupName: string };

/**
 * The header on every trip screen: the menu at the start edge, the group and
 * trip in the middle, the bell at the end edge. Children are in reading order
 * and nothing names a physical side, so the browser places them for RTL.
 *
 * Lives in the trip layout, outside template.tsx, so it never slides with the
 * page and its sheets are never trapped by the template's transform. Its
 * height is --app-header-h (globals.css), which the bars that park under it
 * also read.
 *
 * `roles` come from the layout, which already read them on the server, so the
 * menu's admin rows are there the first time it opens.
 */
export function AppHeader({ trips, roles }: { trips: TripOption[]; roles: MenuRoles }) {
  const { id } = useTrip();
  // Same key the bell and the bottom nav poll, so the badges cost no extra request.
  const { data: inbox } = useInbox();
  const tags = inbox?.counts.tags;
  const [menu, setMenu] = useState(false);
  const waiting = menuBadge(tags, roles);

  return (
    <>
      <header className="sticky top-0 z-30 h-(--app-header-h) bg-canvas/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-md items-center gap-2.5 px-4">
          <button
            onClick={() => setMenu(true)}
            aria-label={waiting > 0 ? `תפריט, ${waiting} ממתינות` : "תפריט"}
            aria-expanded={menu}
            aria-haspopup="dialog"
            className="relative grid size-[46px] shrink-0 place-items-center rounded-full border-[1.5px] border-line bg-surface text-ink transition active:scale-95"
          >
            <Menu className="size-5" />
            {waiting > 0 && (
              <span className="absolute -end-1 -top-1 grid h-[19px] min-w-[19px] place-items-center rounded-full border-2 border-canvas bg-cta px-1 text-[11px] font-bold tabular-nums text-on-cta">
                {waiting}
              </span>
            )}
          </button>

          <TripSwitcher trips={trips} elsewhere={(inbox?.counts.otherTrips ?? 0) > 0} />

          <div className="shrink-0">
            <NotificationsBell />
          </div>
        </div>
      </header>

      <SideSheet open={menu} onClose={() => setMenu(false)} title="תפריט">
        <NavMenu
          tags={tags}
          roles={roles}
          groupId={trips.find((t) => t.id === id)?.groupId}
          onPick={() => setMenu(false)}
        />
      </SideSheet>
    </>
  );
}

/**
 * The screens that are not bottom tabs, each with its own badge. The group
 * admin's row sits between the trip's screens and the app-wide pages: its
 * href depends on the trip's group, which NAV's static list can't express.
 */
function NavMenu({
  tags,
  roles,
  groupId,
  onPick,
}: {
  tags: Unread | undefined;
  roles: MenuRoles;
  groupId: number | undefined;
  onPick: () => void;
}) {
  const { page, local } = useTrip();
  const pathname = local(usePathname());
  const rows = SECONDARY.filter((n) => canSee(n, roles));

  const row = ({ href, label, Icon, outsideTrip }: NavItem) => {
    const active = !outsideTrip && isActive(href, pathname);
    return (
      <MenuRow
        key={href}
        href={outsideTrip ? (href as Route) : page(href)}
        label={label}
        Icon={Icon}
        tone={TONE[href]}
        active={active}
        badge={badgeFor(href, tags)}
        onPick={onPick}
      />
    );
  };

  return (
    <nav className="space-y-1">
      {rows.filter((n) => !n.outsideTrip).map(row)}
      {roles.isAdmin && groupId !== undefined && (
        // Cast like useTrip().page(): typedRoutes can't see a runtime id, and /g/[groupId] is real.
        <MenuRow href={`/g/${groupId}` as Route} label="ניהול הקבוצה" Icon={UserCog} tone={TONE["/group"]} onPick={onPick} />
      )}
      {rows.filter((n) => n.outsideTrip).map(row)}
      <div className="px-1 pt-5">
        <p className="mb-2 px-1 text-[13px] font-bold text-muted">מראה</p>
        <ThemeSwitch />
      </div>
    </nav>
  );
}

/** Each menu row's icon tile, so the rows are told apart at a glance. */
const TONE: Record<string, string> = {
  "/meals": "bg-amber text-amber-ink",
  "/shopping": "bg-sage text-sage-ink",
  "/expenses": "bg-peach text-peach-ink",
  "/leaderboard": "bg-rose text-rose-ink",
  "/me": "bg-coral text-coral-ink",
  "/manage": "bg-coral text-coral-ink",
  "/group": "bg-coral text-coral-ink",
  "/admin": "bg-line text-ink",
};

function MenuRow({
  href,
  label,
  Icon,
  tone = "bg-line text-ink",
  active = false,
  badge = 0,
  onPick,
}: {
  href: Route;
  label: string;
  Icon: LucideIcon;
  tone?: string;
  active?: boolean;
  badge?: number;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      // Rendered only while the menu is open, so this prefetches as it opens
      // and the tap a moment later doesn't wait for the server.
      prefetch
      // Closes from the tap itself, not on a pathname change, so tapping
      // the screen you are already on closes the menu too.
      onClick={() => {
        onPick();
        markTap(href, "menu");
      }}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-card px-2 transition-colors",
        active ? "bg-surface ring-[1.5px] ring-line" : "active:bg-surface",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-[18px]" strokeWidth={2} />
      </span>
      <span className="flex-1 text-base font-semibold text-ink">{label}</span>
      {badge > 0 && (
        <span
          aria-label={badge === 1 ? "תיוג אחד מחכה לך" : `${badge} תיוגים מחכים לך`}
          className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-cta px-1.5 text-xs font-bold tabular-nums text-on-cta"
        >
          {badge}
        </span>
      )}
      <ChevronLeft className="size-[18px] shrink-0 text-muted ltr:rotate-180" />
    </Link>
  );
}

/**
 * The group and trip you are in. With more than one trip it opens a list by
 * group; picking one opens that trip's home. `elsewhere` puts a dot on it when
 * another trip has unread notifications.
 */
function TripSwitcher({ trips, elsewhere }: { trips: TripOption[]; elsewhere: boolean }) {
  const { id } = useTrip();
  const [open, setOpen] = useState(false);
  const current = trips.find((t) => t.id === id);

  const label = (
    <span className="min-w-0 text-center leading-tight">
      {current && (
        <span className="block truncate text-[13px] text-muted">
          {current.groupName}
        </span>
      )}
      <span className="block truncate font-display text-[17px] text-ink">
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
        aria-label={`${current?.name ?? "הטיול"}, להחליף טיול${elsewhere ? ", יש חדש בטיול אחר" : ""}`}
        className="tap flex min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-1 transition active:scale-[0.98]"
      >
        {label}
        <span className="relative shrink-0">
          <ChevronDown className="size-4 text-muted" />
          {elsewhere && (
            <span className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-cta ring-2 ring-canvas" />
          )}
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="הטיולים שלי">
        <div className="space-y-4">
          {[...byGroup.values()].map((list) => (
            <section key={list[0].groupId}>
              <h3 className="mb-1.5 px-1 text-[13px] font-bold text-muted">{list[0].groupName}</h3>
              <ul className="space-y-1">
                {list.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/t/${t.id}`}
                      onClick={() => setOpen(false)}
                      aria-current={t.id === id ? "page" : undefined}
                      className={cn(
                        "tap flex items-center gap-2 rounded-tile px-3 text-base font-semibold transition-colors",
                        t.id === id ? "bg-peach text-peach-ink" : "text-ink active:bg-line/60",
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
